import { u128, u256 } from 'as-bignum/assembly';
import { Blockchain } from '../env';
import { BytesWriter } from '../buffer/BytesWriter';
import { SafeMath } from '../types/SafeMath';
import { Revert } from '../types/Revert';

/**
 * @class StoredU128Array
 * @description Manages an array of u128 values across multiple u256 storage slots. Each u256 slot holds two u128 values.
 */
@final
export class StoredU128Array {
    private readonly baseU256Pointer: u256;
    private readonly lengthPointer: u256;

    // Internal cache for storage slots, each holding two u128 values
    private _values: Map<u64, u128[]> = new Map(); // Map from slotIndex to array of two u128s
    private _isLoaded: Set<u64> = new Set(); // Set of slotIndexes that are loaded
    private _isChanged: Set<u64> = new Set(); // Set of slotIndexes that are modified

    // Internal variables for length and startIndex management
    private _length: u64 = 0; // Current length of the array
    private _startIndex: u64 = 0; // Starting index of the array
    private _isChangedLength: bool = false; // Indicates if the length has been modified
    private _isChangedStartIndex: bool = false; // Indicates if the startIndex has been modified

    // Define a maximum allowed length to prevent excessive storage usage
    private readonly MAX_LENGTH: u64 = u64.MAX_VALUE - 1;

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

        // Initialize the length pointer (slot 0) where both length and startIndex are stored
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
     * @description Retrieves the u128 value at the specified global index.
     * @param {u64} index - The global index (0 to ∞) of the u128 value to retrieve.
     * @returns {u128} - The u128 value at the specified index.
     */
    @inline
    public get(index: u64): u128 {
        assert(index < this._length, 'Index out of bounds');
        const slotIndex: u32 = <u32>(index / 2); // Each slot holds two u128s
        const subIndex: u8 = <u8>(index % 2); // 0 or 1
        this.ensureValues(slotIndex);
        const slotValues = this._values.get(slotIndex);
        if (slotValues) {
            return slotValues[subIndex];
        } else {
            return u128.Zero; // Should not happen, as ensureValues should have loaded it
        }
    }

    /**
     * @method set
     * @description Sets the u128 value at the specified global index.
     * @param {u64} index - The global index (0 to ∞) of the u128 value to set.
     * @param {u128} value - The u128 value to assign.
     */
    @inline
    public set(index: u64, value: u128): void {
        assert(index < this._length, 'Index exceeds current array length');
        const slotIndex: u32 = <u32>(index / 2);
        const subIndex: u8 = <u8>(index % 2);
        this.ensureValues(slotIndex);
        const slotValues = this._values.get(slotIndex);
        if (slotValues) {
            if (!u128.eq(slotValues[subIndex], value)) {
                slotValues[subIndex] = value;
                this._isChanged.add(slotIndex);
            }
        }
    }

    /**
     * @method push
     * @description Appends a new u128 value to the end of the array.
     * @param {u128} value - The u128 value to append.
     */
    public push(value: u128): void {
        if (this._length >= this.MAX_LENGTH) {
            throw new Revert(
                'Push operation failed: Array has reached its maximum allowed length.',
            );
        }

        const newIndex: u64 = this._length;
        const effectiveIndex: u64 = this._startIndex + newIndex;
        const wrappedIndex: u64 =
            effectiveIndex < this.MAX_LENGTH ? effectiveIndex : effectiveIndex % this.MAX_LENGTH;
        const slotIndex: u32 = <u32>(wrappedIndex / 2);
        const subIndex: u8 = <u8>(wrappedIndex % 2);

        // Ensure the slot is loaded
        this.ensureValues(slotIndex);

        // Set the new value in the appropriate sub-index
        const slotValues = this._values.get(slotIndex);
        if (slotValues) {
            slotValues[subIndex] = value;
            this._isChanged.add(slotIndex);
        }

        // Increment the length
        this._length += 1;
        this._isChangedLength = true;
    }

    /**
     * @method delete
     * @description Deletes the u128 value at the specified index by setting it to zero. Does not reorder the array.
     * @param {u64} index - The global index of the u128 value to delete.
     */
    public delete(index: u64): void {
        if (index >= this._length) {
            // If the index is out of bounds, revert the transaction
            throw new Revert('Delete operation failed: Index out of bounds.');
        }

        const slotIndex: u32 = <u32>(index / 2);
        const subIndex: u8 = <u8>(index % 2);
        this.ensureValues(slotIndex);

        const slotValues = this._values.get(slotIndex);
        if (slotValues) {
            // Set the targeted u128 to zero
            if (!u128.eq(slotValues[subIndex], u128.Zero)) {
                slotValues[subIndex] = u128.Zero;
                this._isChanged.add(slotIndex);
            }
        }
    }

    /**
     * @method shift
     * @description Removes the first element of the array by setting it to zero, decrementing the length, and incrementing the startIndex.
     *              If the startIndex reaches the maximum value of u64, it wraps around to 0.
     */
    public shift(): void {
        if (this._length === 0) {
            throw new Revert('Shift operation failed: Array is empty.');
        }

        const currentStartIndex: u64 = this._startIndex;
        const slotIndex: u32 = <u32>(currentStartIndex / 2);
        const subIndex: u8 = <u8>(currentStartIndex % 2);
        this.ensureValues(slotIndex);

        const slotValues = this._values.get(slotIndex);
        if (slotValues) {
            // Set the current start element to zero
            if (!u128.eq(slotValues[subIndex], u128.Zero)) {
                slotValues[subIndex] = u128.Zero;
                this._isChanged.add(slotIndex);
            }
        }

        // Decrement the length
        this._length -= 1;
        this._isChangedLength = true;

        // Increment the startIndex with wrap-around
        if (this._startIndex < this.MAX_LENGTH - 1) {
            this._startIndex += 1;
        } else {
            this._startIndex = 0;
        }
        this._isChangedStartIndex = true;
    }

    /**
     * @method save
     * @description Persists all cached u128 values, the length, and the startIndex to their respective storage slots if any have been modified.
     */
    public save(): void {
        // Save all changed slots
        const values = this._isChanged.values();
        for (let i: u32 = 0; i < <u32>values.length; i++) {
            const slotIndex = values[i];
            const packed = this.packValues(slotIndex);
            const storagePointer = this.calculateStoragePointer(slotIndex);
            Blockchain.setStorageAt(storagePointer, packed);
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
     * @description Sets multiple u128 values starting from a specific global index.
     * @param {u32} startIndex - The starting global index.
     * @param {u128[]} values - An array of u128 values to set.
     */
    @inline
    public setMultiple(startIndex: u32, values: u128[]): void {
        for (let i: u32 = 0; i < values.length; i++) {
            this.set(<u64>(startIndex + i), values[i]);
        }
    }

    /**
     * @method getAll
     * @description Retrieves a range of u128 values starting from a specific global index.
     * @param {u32} startIndex - The starting global index.
     * @param {u32} count - The number of u128 values to retrieve.
     * @returns {u128[]} - An array containing the retrieved u128 values.
     */
    @inline
    public getAll(startIndex: u32, count: u32): u128[] {
        assert(startIndex + count <= this._length, 'Requested range exceeds array length');
        const result: u128[] = new Array<u128>(count);
        for (let i: u32 = 0; i < count; i++) {
            result[i] = this.get(<u64>(startIndex + i));
        }
        return result;
    }

    /**
     * @method toString
     * @description Returns a string representation of all cached u128 values.
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
        const slotCount: u32 = <u32>((this._length + 1) / 2);

        for (let i: u32 = 0; i < slotCount; i++) {
            this.ensureValues(i);
            const packed = this.packValues(i);
            const slotBytes = packed.toBytes();
            for (let j: u32 = 0; j < slotBytes.length; j++) {
                bytes.push(slotBytes[j]);
            }
        }
        return bytes;
    }

    /**
     * @method reset
     * @description Resets all cached u128 values to zero and marks them as changed, including resetting the length and startIndex.
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
     * @method setLength
     * @description Sets the length of the array.
     * @param {u64} newLength - The new length to set.
     */
    public setLength(newLength: u64): void {
        if (newLength > this.MAX_LENGTH) {
            throw new Revert('SetLength operation failed: Length exceeds maximum allowed value.');
        }

        if (newLength < this._length) {
            // Truncate the array if newLength is smaller
            for (let i: u64 = newLength; i < this._length; i++) {
                this.delete(i);
            }
        }

        this._length = newLength;
        this._isChangedLength = true;
    }

    /**
     * @private
     * @method ensureValues
     * @description Loads and caches the u128 values from the specified storage slot.
     * @param {u32} slotIndex - The index of the storage slot.
     */
    private ensureValues(slotIndex: u32): void {
        if (!this._isLoaded.has(slotIndex)) {
            const storagePointer = this.calculateStoragePointer(slotIndex);
            const storedU256: u256 = Blockchain.getStorageAt(storagePointer, this.defaultValue);
            const slotValues = this.unpackU256(storedU256);
            this._values.set(slotIndex, slotValues);
            this._isLoaded.add(slotIndex);
        }
    }

    /**
     * @private
     * @method packValues
     * @description Packs the two cached u128 values into a single u256 for storage.
     * @param {u64} slotIndex - The index of the storage slot.
     * @returns {u256} - The packed u256 value.
     */
    private packValues(slotIndex: u64): u256 {
        const values = this._values.get(slotIndex);
        if (!values) {
            // Should not happen, as ensureValues should have loaded it
            return u256.Zero;
        }
        const packed = new u256();

        // Assign first u128
        packed.lo1 = values[0].lo;
        packed.lo2 = values[0].hi;

        // Assign second u128
        packed.hi1 = values[1].lo;
        packed.hi2 = values[1].hi;

        return packed;
    }

    /**
     * @private
     * @method unpackU256
     * @description Unpacks a u256 value into an array of two u128s.
     * @param {u256} storedU256 - The u256 value to unpack.
     * @returns {u128[]} - An array of two u128 values.
     */
    private unpackU256(storedU256: u256): u128[] {
        const values: u128[] = new Array<u128>(2);

        // Unpack first u128 from lo1 and lo2
        values[0] = new u128(storedU256.lo1, storedU256.lo2);

        // Unpack second u128 from hi1 and hi2
        values[1] = new u128(storedU256.hi1, storedU256.hi2);

        return values;
    }

    /**
     * @private
     * @method calculateStoragePointer
     * @description Calculates the storage pointer for a given slot index by incrementing the base pointer.
     * @param {u64} slotIndex - The index of the storage slot.
     * @returns {u256} - The calculated storage pointer.
     */
    private calculateStoragePointer(slotIndex: u64): u256 {
        return SafeMath.add(this.baseU256Pointer, u256.fromU64(slotIndex + 1));
    }
}
