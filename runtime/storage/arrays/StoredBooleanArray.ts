import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesWriter } from '../../buffer/BytesWriter';
import { Blockchain } from '../../env';
import { Revert } from '../../types/Revert';
import { SafeMath } from '../../types/SafeMath';

/**
 * @class StoredBooleanArray
 * @description Manages an array of boolean values across multiple storage slots. Each slot holds 256 booleans packed into a u256.
 */
@final
export class StoredBooleanArray {
    private readonly baseU256Pointer: u256;
    private readonly lengthPointer: u256;

    // Internal cache for storage slots
    private _values: Map<u64, u256> = new Map(); // Map from slotIndex to u256
    private _isLoaded: Set<u64> = new Set(); // Set of slotIndexes that are loaded
    private _isChanged: Set<u64> = new Set(); // Set of slotIndexes that are modified

    // Internal variables for length and startIndex management
    private _length: u64 = 0; // Current length of the array
    private _startIndex: u64 = 0; // Starting index of the array
    private _isChangedLength: bool = false; // Indicates if the length has been modified
    private _isChangedStartIndex: bool = false; // Indicates if the startIndex has been modified

    // Define a maximum allowed length to prevent excessive storage usage
    private readonly MAX_LENGTH: u64 = u32.MAX_VALUE;

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

        this._length = storedLengthAndStartIndex.lo1; // Bytes 0-7: length
        this._startIndex = storedLengthAndStartIndex.lo2; // Bytes 8-15: startIndex
    }

    /**
     * @method get
     * @description Retrieves the boolean value at the specified global index.
     * @param {u64} index - The global index (0 to ∞) of the boolean value to retrieve.
     * @returns {bool} - The boolean value at the specified index.
     */
    @inline
    public get(index: u64): bool {
        const slotIndex: u64 = index / 256; // Each slot holds 256 bits
        const bitIndex: u16 = <u16>(index % 256); // 0 to 255

        this.ensureValues(slotIndex);

        const slotValue = this._values.get(slotIndex);
        if (slotValue) {
            return this.getBit(slotValue, bitIndex);
        } else {
            return false;
        }
    }

    /**
     * @method set
     * @description Sets the boolean value at the specified global index.
     * @param {u64} index - The global index (0 to ∞) of the boolean value to set.
     * @param {bool} value - The boolean value to assign.
     */
    @inline
    public set(index: u64, value: bool): void {
        if (index > this.MAX_LENGTH) {
            throw new Revert('Set operation failed: Index exceeds maximum allowed value.');
        }

        const slotIndex: u64 = index / 256;
        const bitIndex: u16 = <u16>(index % 256);
        this.ensureValues(slotIndex);

        const slotValue = this._values.get(slotIndex);
        if (slotValue) {
            const oldValue = this.getBit(slotValue, bitIndex);
            if (oldValue != value) {
                this.setBit(slotValue, bitIndex, value);
                this._isChanged.add(slotIndex);
            }
        }
    }

    /**
     * @method push
     * @description Appends a new boolean value to the end of the array.
     * @param {bool} value - The boolean value to append.
     */
    public push(value: bool): void {
        if (this._length > this.MAX_LENGTH) {
            throw new Revert(
                'Push operation failed: Array has reached its maximum allowed length.',
            );
        }

        const newIndex: u64 = this._length;
        const effectiveIndex: u64 = this._startIndex + newIndex;
        const wrappedIndex: u64 =
            effectiveIndex < this.MAX_LENGTH ? effectiveIndex : effectiveIndex % this.MAX_LENGTH;

        const slotIndex: u64 = wrappedIndex / 256;
        const bitIndex: u8 = <u8>(wrappedIndex % 256);

        // Ensure the slot is loaded
        this.ensureValues(slotIndex);

        // Set the new value
        const slotValue = this._values.get(slotIndex);
        if (slotValue) {
            this.setBit(slotValue, bitIndex, value);
            this._isChanged.add(slotIndex);
        }

        // Increment the length
        this._length += 1;
        this._isChangedLength = true;
    }

    /**
     * @method delete
     * @description Deletes the boolean value at the specified index by setting it to false. Does not reorder the array.
     * @param {u64} index - The global index of the boolean value to delete.
     */
    public delete(index: u64): void {
        const slotIndex: u64 = index / 256;
        const bitIndex: u16 = <u16>(index % 256);
        this.ensureValues(slotIndex);

        const slotValue = this._values.get(slotIndex);
        if (slotValue) {
            const oldValue = this.getBit(slotValue, bitIndex);
            if (oldValue != false) {
                this.setBit(slotValue, bitIndex, false);
                this._isChanged.add(slotIndex);
            }
        }
    }

    /**
     * @method save
     * @description Persists all cached boolean values, the length, and the startIndex to their respective storage slots if any have been modified.
     */
    public save(): void {
        // Save all changed slots
        const values = this._isChanged.values();
        for (let i = 0; i < values.length; i++) {
            const slotIndex = values[i];
            const slotValue = this._values.get(slotIndex);
            if (slotValue) {
                const storagePointer = this.calculateStoragePointer(slotIndex);
                Blockchain.setStorageAt(storagePointer, slotValue);
            }
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
     * @description Sets multiple boolean values starting from a specific global index.
     * @param {u64} startIndex - The starting global index.
     * @param {bool[]} values - An array of boolean values to set.
     */
    @inline
    public setMultiple(startIndex: u64, values: bool[]): void {
        for (let i: u64 = 0; i < values.length; i++) {
            this.set(startIndex + i, values[i]);
        }
    }

    /**
     * @method getAll
     * @description Retrieves a range of boolean values starting from a specific global index.
     * @param {u64} startIndex - The starting global index.
     * @param {u64} count - The number of boolean values to retrieve.
     * @returns {bool[]} - An array containing the retrieved boolean values.
     */
    @inline
    public getAll(startIndex: u64, count: u64): bool[] {
        if ((startIndex + count) > this._length) {
            throw new Revert('Requested range exceeds array length');
        }

        if (u32.MAX_VALUE < count) {
            throw new Revert('Requested range exceeds maximum allowed value.');
        }

        const result: bool[] = new Array<bool>(count as u32);
        for (let i: u64 = 0; i < count; i++) {
            result[i as u32] = this.get(startIndex + i);
        }
        return result;
    }

    /**
     * @method toString
     * @description Returns a string representation of all cached boolean values.
     * @returns {string} - A string in the format "[true, false, ..., true]".
     */
    @inline
    public toString(): string {
        let str = '[';
        for (let i: u64 = 0; i < this._length; i++) {
            const value = this.get(i);
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
        const slotCount: u64 = (this._length + 255) / 256;

        for (let slotIndex: u64 = 0; slotIndex < slotCount; slotIndex++) {
            this.ensureValues(slotIndex);
            const slotValue = this._values.get(slotIndex);
            if (slotValue) {
                const slotBytes = slotValue.toBytes();
                for (let i: u32 = 0; i < slotBytes.length; i++) {
                    bytes.push(slotBytes[i]);
                }
            }
        }
        return bytes;
    }

    /**
     * @method reset
     * @description Resets all cached boolean values to false and marks them as changed, including resetting the length and startIndex.
     */
    @inline
    public reset(): void {
        // Reset the length and startIndex to zero
        this._length = 0;
        this._startIndex = 0;
        this._isChangedLength = true;
        this._isChangedStartIndex = true;

        // Clear internal caches
        this._values.clear();
        this._isLoaded.clear();
        this._isChanged.clear();

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
     * @method deleteLast
     * @description Deletes the last element of the array by setting it to false and decrementing the length.
     */
    public deleteLast(): void {
        if (this._length === 0) {
            throw new Revert('DeleteLast operation failed: Array is empty.');
        }

        const index = this._length - 1;
        this.delete(index);

        // Decrement the length
        this._length -= 1;
        this._isChangedLength = true;
    }

    /**
     * @private
     * @method ensureValues
     * @description Loads and caches the u256 value from the specified storage slot.
     * @param {u64} slotIndex - The index of the storage slot.
     */
    private ensureValues(slotIndex: u64): void {
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
     * @param {u64} slotIndex - The index of the storage slot.
     * @returns {u256} - The calculated storage pointer.
     */
    private calculateStoragePointer(slotIndex: u64): u256 {
        // Each slot is identified by baseU256Pointer + slotIndex + 1
        return SafeMath.add(this.baseU256Pointer, u256.fromU64(slotIndex + 1));
    }

    /**
     * @private
     * @method getBit
     * @description Retrieves the bit value at the specified bit index from the u256 value.
     * @param {u256} value - The u256 value containing the bits.
     * @param {u16} bitIndex - The index of the bit to retrieve (0-255).
     * @returns {bool} - The value of the bit at the specified index.
     */
    private getBit(value: u256, bitIndex: u16): bool {
        if (!(bitIndex < 256)) {
            throw new Revert('Bit index out of range');
        }

        if (bitIndex < 64) {
            return ((value.lo1 >> bitIndex) & 0b1) == 1;
        } else if (bitIndex < 128) {
            return ((value.lo2 >> (bitIndex - 64)) & 0b1) == 1;
        } else if (bitIndex < 192) {
            return ((value.hi1 >> (bitIndex - 128)) & 0b1) == 1;
        } else {
            return ((value.hi2 >> (bitIndex - 192)) & 0b1) == 1;
        }
    }

    /**
     * @private
     * @method setBit
     * @description Sets the bit value at the specified bit index in the u256 value.
     * @param {u256} value - The u256 value containing the bits.
     * @param {u16} bitIndex - The index of the bit to set (0-255).
     * @param {bool} bitValue - The value to set (true or false).
     */
    private setBit(value: u256, bitIndex: u16, bitValue: bool): void {
        if (!(bitIndex < 256)) {
            throw new Revert('Bit index out of range');
        }

        if (bitIndex < 64) {
            const mask = u64(1) << bitIndex;
            if (bitValue) {
                value.lo1 |= mask;
            } else {
                value.lo1 &= ~mask;
            }
        } else if (bitIndex < 128) {
            const mask = u64(1) << (bitIndex - 64);
            if (bitValue) {
                value.lo2 |= mask;
            } else {
                value.lo2 &= ~mask;
            }
        } else if (bitIndex < 192) {
            const mask = u64(1) << (bitIndex - 128);
            if (bitValue) {
                value.hi1 |= mask;
            } else {
                value.hi1 &= ~mask;
            }
        } else {
            const mask = u64(1) << (bitIndex - 192);
            if (bitValue) {
                value.hi2 |= mask;
            } else {
                value.hi2 &= ~mask;
            }
        }
    }
}
