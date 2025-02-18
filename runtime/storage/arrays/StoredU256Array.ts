import { u256 } from '@btc-vision/as-bignum/assembly';
import { Blockchain } from '../../env';
import { BytesWriter } from '../../buffer/BytesWriter';
import { SafeMath } from '../../types/SafeMath';
import { Revert } from '../../types/Revert';

/**
 * @class StoredU256Array
 * @description Manages an array of u256 values across multiple storage slots. Each slot holds one u256 value.
 */
@final
export class StoredU256Array {
    private readonly baseU256Pointer: u256;
    private readonly lengthPointer: u256;

    // Internal cache for storage slots
    private _values: Map<u64, u256> = new Map(); // Map from slotIndex to u256 value
    private _isLoaded: Set<u64> = new Set(); // Set of slotIndexes that are loaded
    private _isChanged: Set<u64> = new Set(); // Set of slotIndexes that are modified

    // Internal variables for length and startIndex management
    private _length: u64 = 0;     // Current length of the array
    private _startIndex: u64 = 0; // Starting index of the array
    private _isChangedLength: bool = false;      // Indicates if the length has been modified
    private _isChangedStartIndex: bool = false;  // Indicates if the startIndex has been modified

    // Define a maximum allowed length to prevent excessive storage usage
    private readonly MAX_LENGTH: u64 = u64(u32.MAX_VALUE - 1);

    /**
     * @constructor
     * @param {u16} pointer - The primary pointer identifier.
     * @param {Uint8Array} subPointer - The sub-pointer for memory slot addressing.
     * @param {u256} defaultValue - The default u256 value if storage is uninitialized.
     */
    constructor(
        public pointer: u16,
        public subPointer: Uint8Array,
        private defaultValue: u256,
    ) {
        // Initialize the base u256 pointer using the primary pointer and subPointer
        const writer = new BytesWriter(32);
        writer.writeU16(pointer);
        writer.writeBytes(subPointer);

        // Initialize the base and length pointers
        const baseU256Pointer = u256.fromBytes(writer.getBuffer(), true);
        const lengthPointer = baseU256Pointer.clone();

        // Load the current length and startIndex from storage
        const storedLengthAndStartIndex: u256 = Blockchain.getStorageAt(lengthPointer, u256.Zero);
        this.lengthPointer = lengthPointer;
        this.baseU256Pointer = baseU256Pointer;

        this._length = storedLengthAndStartIndex.lo1;  // Bytes 0-7: length
        this._startIndex = storedLengthAndStartIndex.lo2; // Bytes 8-15: startIndex
    }

    /**
     * @method get
     * @description Retrieves the u256 value at the specified global index.
     *              Returns zero instead of reverting if the index is out of bounds.
     * @param {u64} index - The global index (0 to ∞) of the u256 value to retrieve.
     * @returns {u256} - The u256 value at the specified index or zero if out of bounds.
     */
    @inline
    public get(index: u64): u256 {
        if (index > this.MAX_LENGTH) {
            throw new Revert('Operation failed: Index exceeds maximum allowed value.');
        }

        const slotIndex: u32 = <u32>index;
        this.ensureValues(slotIndex);

        const value = this._values.get(slotIndex);
        return value ? value : u256.Zero;
    }

    /**
     * @method set
     * @description Sets the u256 value at the specified global index.
     * @param {u64} index - The global index (0 to ∞) of the u256 value to set.
     * @param {u256} value - The u256 value to assign.
     */
    @inline
    public set(index: u64, value: u256): void {
        if (index > this.MAX_LENGTH) {
            throw new Revert('Set operation failed: Index exceeds maximum allowed value.');
        }

        const slotIndex: u32 = <u32>index;
        this.ensureValues(slotIndex);

        const currentValue = this._values.get(slotIndex);
        if (!u256.eq(currentValue, value)) {
            this._values.set(slotIndex, value);
            this._isChanged.add(slotIndex);
        }
    }

    /**
     * @method push
     * @description Appends a new u256 value to the end of the array.
     * @param {u256} value - The u256 value to append.
     */
    public push(value: u256): void {
        if (this._length >= this.MAX_LENGTH) {
            throw new Revert(
                'Push operation failed: Array has reached its maximum allowed length.',
            );
        }

        const newIndex: u64 = this._length;
        const wrappedIndex: u64 =
            newIndex < this.MAX_LENGTH ? newIndex : newIndex % this.MAX_LENGTH;
        const slotIndex: u32 = <u32>wrappedIndex;

        // Ensure the slot is loaded
        this.ensureValues(slotIndex);

        // Set the new value
        this._values.set(slotIndex, value);
        this._isChanged.add(slotIndex);

        // Increment the length
        this._length += 1;
        this._isChangedLength = true;
    }

    public deleteLast(): void {
        if (this._length === 0) {
            throw new Revert('Delete operation failed: Array is empty.');
        }

        const lastIndex: u64 = this._length - 1;
        const slotIndex: u32 = <u32>(this._startIndex + lastIndex);
        this.ensureValues(slotIndex);

        const currentValue = this._values.get(slotIndex);
        if (!u256.eq(currentValue, u256.Zero)) {
            this._values.set(slotIndex, u256.Zero);
            this._isChanged.add(slotIndex);
        }

        // Decrement the length
        this._length -= 1;
        this._isChangedLength = true;
    }

    public setStartingIndex(index: u64): void {
        this._startIndex = index;
        this._isChangedStartIndex = true;
    }

    /**
     * @method delete
     * @description Deletes the u256 value at the specified index by setting it to zero. Does not reorder the array.
     * @param {u64} index - The global index of the u256 value to delete.
     */
    public delete(index: u64): void {
        if (index > this.MAX_LENGTH) {
            throw new Revert('Operation failed: Index exceeds maximum allowed value.');
        }

        const slotIndex: u32 = <u32>index;
        this.ensureValues(slotIndex);

        const currentValue = this._values.get(slotIndex);
        if (!u256.eq(currentValue, u256.Zero)) {
            this._values.set(slotIndex, u256.Zero);
            this._isChanged.add(slotIndex);
        }
    }

    /**
     * @method save
     * @description Persists all cached u256 values, the length, and the startIndex to their respective storage slots
     *              if any have been modified.
     */
    public save(): void {
        // Save all changed slots
        const changed = this._isChanged.values();
        for (let i = 0; i < changed.length; i++) {
            const slotIndex = changed[i];
            const storagePointer = this.calculateStoragePointer(slotIndex);
            const value = this._values.get(slotIndex);
            Blockchain.setStorageAt(storagePointer, value);
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
     * @description Deletes all storage slots by setting them to zero, including the length and startIndex slots.
     */
    public deleteAll(): void {
        // Iterate over all loaded slots and clear them
        const keys = this._values.keys();
        for (let i = 0; i < keys.length; i++) {
            const slotIndex = keys[i];
            const storagePointer = this.calculateStoragePointer(slotIndex);
            Blockchain.setStorageAt(storagePointer, u256.Zero);
        }

        // Reset the length and startIndex to zero
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
     * @description Sets multiple u256 values starting from a specific global index.
     * @param {u32} startIndex - The starting global index.
     * @param {u256[]} values - An array of u256 values to set.
     */
    @inline
    public setMultiple(startIndex: u32, values: u256[]): void {
        for (let i: u32 = 0; i < values.length; i++) {
            this.set(<u64>(startIndex + i), values[i]);
        }
    }

    /**
     * @method getAll
     * @description Retrieves a range of u256 values starting from a specific global index.
     * @param {u32} startIndex - The starting global index.
     * @param {u32} count - The number of u256 values to retrieve.
     * @returns {u256[]} - An array containing the retrieved u256 values.
     */
    @inline
    public getAll(startIndex: u32, count: u32): u256[] {
        if ((startIndex + count) > this._length) {
            throw new Revert('Requested range exceeds array length');
        }
        const result: u256[] = new Array<u256>(count);
        for (let i: u32 = 0; i < count; i++) {
            result[i] = this.get(<u64>(startIndex + i));
        }
        return result;
    }

    /**
     * @method toString
     * @description Returns a string representation of all cached u256 values.
     * @returns {string} - A string in the format "[value0, value1, ..., valueN]".
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
     * @description Returns the packed u256 values as a byte array.
     * @returns {u8[]} - The packed u256 values in byte form.
     */
    @inline
    public toBytes(): u8[] {
        const bytes: u8[] = new Array<u8>();
        for (let i: u32 = 0; i < this._length; i++) {
            this.ensureValues(i);
            const value = this._values.get(i);
            if (value) {
                const valueBytes = value.toBytes();
                for (let j: u32 = 0; j < valueBytes.length; j++) {
                    bytes.push(valueBytes[j]);
                }
            }
        }
        return bytes;
    }

    /**
     * @method reset
     * @description Resets all cached u256 values to zero and marks them as changed, including resetting the length and startIndex.
     */
    @inline
    public reset(): void {
        // Reset the length and startIndex to zero
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
     * @description Loads and caches the u256 value from the specified storage slot.
     * @param {u32} slotIndex - The index of the storage slot.
     */
    private ensureValues(slotIndex: u32): void {
        if (!this._isLoaded.has(slotIndex)) {
            const storagePointer = this.calculateStoragePointer(slotIndex);
            const storedU256: u256 = Blockchain.getStorageAt(storagePointer, this.defaultValue);
            this._values.set(slotIndex, storedU256);
            this._isLoaded.add(slotIndex);
        }
    }

    /**
     * @private
     * @method calculateStoragePointer
     * @description Calculates the storage pointer for a given slot index by incrementing the base pointer.
     * @param {u32} slotIndex - The index of the storage slot.
     * @returns {u256} - The calculated storage pointer.
     */
    private calculateStoragePointer(slotIndex: u64): u256 {
        // Each slot is identified by baseU256Pointer + slotIndex + 1
        // Slot 0: baseU256Pointer + 1 (first element)
        // Slot 1: baseU256Pointer + 2, etc.
        return SafeMath.add(this.baseU256Pointer, u256.fromU64(slotIndex + 1));
    }
}
