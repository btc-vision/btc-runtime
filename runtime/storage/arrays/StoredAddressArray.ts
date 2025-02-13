import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesWriter } from '../../buffer/BytesWriter';
import { Blockchain } from '../../env';
import { Address } from '../../types/Address';
import { Revert } from '../../types/Revert';
import { SafeMath } from '../../types/SafeMath';

/**
 * @class StoredAddressArray
 * @description Manages an array of Address values across multiple storage slots.
 * Each slot holds one Address (stored as u256 in storage).
 */
@final
export class StoredAddressArray {
    private readonly baseU256Pointer: u256;
    private readonly lengthPointer: u256;

    // Internal cache for storage slots
    private _values: Map<u64, Address> = new Map(); // Map from slotIndex to Address value
    private _isLoaded: Set<u64> = new Set(); // Set of slotIndexes that are loaded
    private _isChanged: Set<u64> = new Set(); // Set of slotIndexes that are modified

    // Internal variables for length and startIndex management
    private _length: u64 = 0; // Current length of the array
    private _startIndex: u64 = 0; // Starting index of the array
    private _isChangedLength: bool = false; // Indicates if the length has been modified
    private _isChangedStartIndex: bool = false; // Indicates if the startIndex has been modified

    // Define a maximum allowed length to prevent excessive storage usage
    private readonly MAX_LENGTH: u64 = u64(u32.MAX_VALUE - 1);

    /**
     * @constructor
     * @param {u16} pointer - The primary pointer identifier.
     * @param {Uint8Array} subPointer - The sub-pointer for memory slot addressing.
     * @param {Address} defaultValue - The default Address value if storage is uninitialized.
     */
    constructor(public pointer: u16, public subPointer: Uint8Array, private defaultValue: Address) {
        // Initialize the base pointer
        const writer = new BytesWriter(32);
        writer.writeU16(pointer);
        writer.writeBytes(subPointer);

        const baseU256Pointer = u256.fromBytes(writer.getBuffer(), true);
        const lengthPointer = baseU256Pointer.clone();

        // Load the current length and startIndex from storage
        const storedLengthAndStartIndex: u256 = Blockchain.getStorageAt(lengthPointer, u256.Zero);
        this.lengthPointer = lengthPointer;
        this.baseU256Pointer = baseU256Pointer;

        this._length = storedLengthAndStartIndex.lo1; // Bytes 0-7: length
        this._startIndex = storedLengthAndStartIndex.lo2; // Bytes 8-15: startIndex
    }

    /**
     * @method get
     * @description Retrieves the Address value at the specified global index.
     * @param {u64} index - The global index of the Address to retrieve.
     * @returns {Address} - The Address value at the specified index.
     */
    @inline
    public get(index: u64): Address {
        if (index > this.MAX_LENGTH) {
            throw new Revert('Operation failed: Index exceeds maximum allowed value.');
        }

        const slotIndex: u32 = <u32>index;
        this.ensureValues(slotIndex);

        const value = this._values.get(slotIndex);
        return value ? value : this.defaultValue;
    }

    /**
     * @method set
     * @description Sets the Address value at the specified global index.
     * @param {u64} index - The global index of the Address to set.
     * @param {Address} value - The Address value to assign.
     */
    @inline
    public set(index: u64, value: Address): void {
        if (index > this.MAX_LENGTH) {
            throw new Revert('Set operation failed: Index exceeds maximum allowed value.');
        }

        const slotIndex: u32 = <u32>index;
        this.ensureValues(slotIndex);

        const currentValue = this._values.get(slotIndex);
        if (currentValue != value) {
            this._values.set(slotIndex, value);
            this._isChanged.add(slotIndex);
        }
    }

    /**
     * @method indexOf
     * @description Searches for the first occurrence of the specified Address value and returns its index.
     * @param {Address} value - The Address to locate.
     * @returns {i64} - The index of the first occurrence, or -1 if not found.
     */
    @inline
    public indexOf(value: Address): i64 {
        for (let i: u64 = 0; i < this._length; i++) {
            const currentValue = this.get(i);
            if (currentValue == value) {
                return i64(i);
            }
        }
        return -1;
    }

    /**
     * @method contains
     * @description Determines whether the array contains the specified Address value.
     * @param {Address} value - The Address to locate.
     * @returns {boolean} - True if found; otherwise, false.
     */
    @inline
    public contains(value: Address): boolean {
        return this.indexOf(value) !== -1;
    }

    /**
     * @method push
     * @description Appends a new Address value to the end of the array.
     * @param {Address} value - The Address to append.
     */
    public push(value: Address): void {
        if (this._length >= this.MAX_LENGTH) {
            throw new Revert(
                'Push operation failed: Array has reached its maximum allowed length.',
            );
        }

        const newIndex: u64 = this._length;
        const wrappedIndex: u64 =
            newIndex < this.MAX_LENGTH ? newIndex : newIndex % this.MAX_LENGTH;
        const slotIndex: u32 = <u32>wrappedIndex;

        this.ensureValues(slotIndex);
        this._values.set(slotIndex, value);
        this._isChanged.add(slotIndex);

        this._length += 1;
        this._isChangedLength = true;
    }

    /**
     * @method deleteLast
     * @description Deletes the last element from the array.
     */
    public deleteLast(): void {
        if (this._length === 0) {
            throw new Revert('Delete operation failed: Array is empty.');
        }

        const lastIndex: u64 = this._length - 1;
        const slotIndex: u32 = <u32>(this._startIndex + lastIndex);
        this.ensureValues(slotIndex);

        const currentValue = this._values.get(slotIndex);
        if (currentValue != this.defaultValue) {
            this._values.set(slotIndex, this.defaultValue);
            this._isChanged.add(slotIndex);
        }

        this._length -= 1;
        this._isChangedLength = true;
    }

    /**
     * @method setStartingIndex
     * @description Sets the starting index of the array.
     * @param {u64} index - The new starting index.
     */
    public setStartingIndex(index: u64): void {
        this._startIndex = index;
        this._isChangedStartIndex = true;
    }

    /**
     * @method delete
     * @description Deletes the Address value at the specified index by setting it to defaultValue.
     * @param {u64} index - The global index of the Address value to delete.
     */
    public delete(index: u64): void {
        if (index > this.MAX_LENGTH) {
            throw new Revert('Operation failed: Index exceeds maximum allowed value.');
        }

        const slotIndex: u32 = <u32>index;
        this.ensureValues(slotIndex);

        const currentValue = this._values.get(slotIndex);
        if (currentValue != this.defaultValue) {
            this._values.set(slotIndex, this.defaultValue);
            this._isChanged.add(slotIndex);
        }
    }

    /**
     * @method save
     * @description Persists all changes to storage.
     */
    public save(): void {
        // Save all changed slots
        const changed = this._isChanged.values();
        for (let i = 0; i < changed.length; i++) {
            const slotIndex = changed[i];
            const storagePointer = this.calculateStoragePointer(slotIndex);
            const value = this._values.get(slotIndex);
            Blockchain.setStorageAt(storagePointer, u256.fromBytes(value));
        }
        this._isChanged.clear();

        // Save length and startIndex if changed
        if (this._isChangedLength || this._isChangedStartIndex) {
            const packedLengthAndStartIndex = new u256();
            packedLengthAndStartIndex.lo1 = this._length;
            packedLengthAndStartIndex.lo2 = this._startIndex;
            Blockchain.setStorageAt(this.lengthPointer, packedLengthAndStartIndex);
            this._isChangedLength = false;
            this._isChangedStartIndex = false;
        }
    }

    /**
     * @method deleteAll
     * @description Deletes the entire array and resets length and startIndex.
     */
    public deleteAll(): void {
        // Clear all loaded slots
        const keys = this._values.keys();
        for (let i = 0; i < keys.length; i++) {
            const slotIndex = keys[i];
            const storagePointer = this.calculateStoragePointer(slotIndex);
            Blockchain.setStorageAt(storagePointer, u256.fromBytes(this.defaultValue));
        }

        // Reset the length and startIndex
        const zeroLengthAndStartIndex = u256.Zero;
        Blockchain.setStorageAt(this.lengthPointer, zeroLengthAndStartIndex);
        this._length = 0;
        this._startIndex = 0;
        this._isChangedLength = false;
        this._isChangedStartIndex = false;

        // Clear internal caches
        this._values.clear();
        this._isLoaded.clear();
        this._isChanged.clear();
    }

    /**
     * @method setMultiple
     * @description Sets multiple Address values starting from a specific global index.
     * @param {u32} startIndex - The starting global index.
     * @param {Address[]} values - An array of Address values to set.
     */
    @inline
    public setMultiple(startIndex: u32, values: Address[]): void {
        for (let i: u32 = 0; i < values.length; i++) {
            this.set(<u64>(startIndex + i), values[i]);
        }
    }

    /**
     * @method getAll
     * @description Retrieves a range of Address values.
     * @param {u32} startIndex - The start index.
     * @param {u32} count - The number of items to get.
     * @returns {Address[]} - The requested Address values.
     */
    @inline
    public getAll(startIndex: u32, count: u32): Address[] {
        if (startIndex + count > this._length) {
            throw new Revert('Requested range exceeds array length');
        }

        const result: Address[] = new Array<Address>(count);
        for (let i: u32 = 0; i < count; i++) {
            result[i] = this.get(<u64>(startIndex + i));
        }
        return result;
    }

    /**
     * @method toString
     * @description Returns a string representation of the array.
     * @returns {string} - A string of the form "[addr0, addr1, ...]".
     */
    @inline
    public toString(): string {
        let str = '[';
        for (let i: u32 = 0; i < this._length; i++) {
            const value = this.get(<u64>i);
            str += value.toString();
            if (i !== this._length - 1) {
                str += ', ';
            }
        }
        str += ']';
        return str;
    }

    /**
     * @method toBytes
     * @description Returns the packed Address values as a byte array.
     * @returns {u8[]} - The packed byte array.
     */
    @inline
    public toBytes(): u8[] {
        const bytes: u8[] = new Array<u8>();
        for (let i: u32 = 0; i < this._length; i++) {
            this.ensureValues(i);
            const value = this._values.get(i);
            if (value) {
                const valueBytes = value; // Address is assumed to be or contain a Uint8Array
                for (let j: u32 = 0; j < valueBytes.length; j++) {
                    bytes.push(valueBytes[j]);
                }
            }
        }
        return bytes;
    }

    /**
     * @method reset
     * @description Resets the array by clearing all elements and resetting length and startIndex to zero.
     */
    @inline
    public reset(): void {
        this._length = 0;
        this._startIndex = 0;
        this._isChangedLength = true;
        this._isChangedStartIndex = true;
        this.save();
    }

    /**
     * @method getLength
     * @description Retrieves the current length of the array.
     * @returns {u64} - The current length.
     */
    @inline
    public getLength(): u64 {
        return this._length;
    }

    /**
     * @method startingIndex
     * @description Retrieves the current starting index of the array.
     * @returns {u64} - The starting index.
     */
    public startingIndex(): u64 {
        return this._startIndex;
    }

    /**
     * @private
     * @method ensureValues
     * @description Loads and caches the Address from the specified storage slot if not already loaded.
     * @param {u32} slotIndex - The index of the storage slot.
     */
    private ensureValues(slotIndex: u32): void {
        if (!this._isLoaded.has(slotIndex)) {
            const storagePointer = this.calculateStoragePointer(slotIndex);
            const storedU256: u256 = Blockchain.getStorageAt(storagePointer, u256.Zero);
            const storedAddress: Address =
                storedU256 == u256.Zero ? this.defaultValue : new Address(storedU256.toBytes());
            this._values.set(slotIndex, storedAddress);
            this._isLoaded.add(slotIndex);
        }
    }

    /**
     * @private
     * @method calculateStoragePointer
     * @description Calculates the storage pointer for a given slot index.
     * @param {u64} slotIndex - The index of the storage slot.
     * @returns {u256} - The calculated storage pointer.
     */
    private calculateStoragePointer(slotIndex: u64): u256 {
        // Each slot is identified by baseU256Pointer + slotIndex + 1
        // Slot 0: baseU256Pointer + 1
        // Slot 1: baseU256Pointer + 2, etc.
        return SafeMath.add(this.baseU256Pointer, u256.fromU64(slotIndex + 1));
    }
}
