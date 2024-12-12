import { u256 } from '@btc-vision/as-bignum/assembly';
import { Blockchain } from '../env';
import { BytesWriter } from '../buffer/BytesWriter';
import { SafeMath } from '../types/SafeMath';
import { Revert } from '../types/Revert';

/**
 * @class StoredU16Array
 * @description Manages an array of u16 values across multiple storage slots. Each slot holds sixteen u16 values packed into a u256.
 */
@final
export class StoredU16Array {
    private readonly baseU256Pointer: u256;
    private readonly lengthPointer: u256;

    // Internal cache for storage slots
    private _values: Map<u64, u16[]> = new Map(); // Map from slotIndex to array of sixteen u16s
    private _isLoaded: Set<u64> = new Set(); // Set of slotIndexes that are loaded
    private _isChanged: Set<u64> = new Set(); // Set of slotIndexes that are modified

    // Internal variables for length and startIndex management
    private _length: u64 = 0; // Current length of the array
    private _startIndex: u64 = 0; // Starting index of the array
    private _isChangedLength: bool = false; // Indicates if the length has been modified
    private _isChangedStartIndex: bool = false; // Indicates if the startIndex has been modified

    // Define a maximum allowed length to prevent excessive storage usage
    private readonly MAX_LENGTH: u64 = u64(u32.MAX_VALUE - 1); // we need to check what happen in overflow situation to be able to set it to u64.MAX_VALUE

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
     * @description Retrieves the u16 value at the specified global index.
     * @param {u64} index - The global index (0 to ∞) of the u16 value to retrieve.
     * @returns {u16} - The u16 value at the specified index.
     */
    @inline
    public get(index: u64): u16 {
        assert(index < this._length, 'Index out of bounds');

        const slotIndex: u64 = index / 16; // Each slot holds sixteen u16s
        const subIndex: u8 = <u8>(index % 16); // 0 to 15
        this.ensureValues(slotIndex);
        const slotValues = this._values.get(slotIndex);
        return slotValues ? slotValues[subIndex] : 0;
    }

    /**
     * @method set
     * @description Sets the u16 value at the specified global index.
     * @param {u64} index - The global index (0 to ∞) of the u16 value to set.
     * @param {u16} value - The u16 value to assign.
     */
    @inline
    public set(index: u64, value: u16): void {
        assert(index < this._length, 'Index exceeds current array length');
        const slotIndex: u64 = index / 16;
        const subIndex: u8 = <u8>(index % 16);
        this.ensureValues(slotIndex);

        const slotValues = this._values.get(slotIndex);
        if (slotValues && slotValues[subIndex] !== value) {
            slotValues[subIndex] = value;
            this._isChanged.add(slotIndex);
        }
    }

    /**
     * @method push
     * @description Appends a new u16 value to the end of the array.
     * @param {u16} value - The u16 value to append.
     */
    public push(value: u16): void {
        if (this._length >= this.MAX_LENGTH) {
            throw new Revert(
                'Push operation failed: Array has reached its maximum allowed length.',
            );
        }

        const newIndex: u64 = this._length;
        const wrappedIndex: u64 =
            newIndex < this.MAX_LENGTH ? newIndex : newIndex % this.MAX_LENGTH;
        
        const slotIndex: u64 = wrappedIndex / 16;
        const subIndex: u8 = <u8>(wrappedIndex % 16);

        // Ensure the slot is loaded
        this.ensureValues(slotIndex);

        // Set the new value
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
     * @description Deletes the u16 value at the specified index by setting it to zero. Does not reorder the array.
     * @param {u64} index - The global index of the u16 value to delete.
     */
    public delete(index: u64): void {
        if (index >= this._length) {
            throw new Revert('Delete operation failed: Index out of bounds.');
        }

        const slotIndex: u64 = index / 16;
        const subIndex: u8 = <u8>(index % 16);
        this.ensureValues(slotIndex);

        const slotValues = this._values.get(slotIndex);
        if (slotValues && slotValues[subIndex] !== 0) {
            slotValues[subIndex] = 0;
            this._isChanged.add(slotIndex);
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
        const slotIndex: u64 = currentStartIndex / 16;
        const subIndex: u8 = <u8>(currentStartIndex % 16);
        this.ensureValues(slotIndex);

        const slotValues = this._values.get(slotIndex);
        if (slotValues && slotValues[subIndex] !== 0) {
            slotValues[subIndex] = 0;
            this._isChanged.add(slotIndex);
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
     * @description Persists all cached u16 values, the length, and the startIndex to their respective storage slots if any have been modified.
     */
    public save(): void {
        // Save all changed slots
        const values = this._isChanged.values();
        for (let i = 0; i < values.length; i++) {
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
     * @description Sets multiple u16 values starting from a specific global index.
     * @param {u64} startIndex - The starting global index.
     * @param {u16[]} values - An array of u16 values to set.
     */
    @inline
    public setMultiple(startIndex: u64, values: u16[]): void {
        for (let i: u64 = 0; i < values.length; i++) {
            this.set(startIndex + i, values[i]);
        }
    }

    /**
     * @method getAll
     * @description Retrieves a range of u16 values starting from a specific global index.
     * @param {u64} startIndex - The starting global index.
     * @param {u64} count - The number of u16 values to retrieve.
     * @returns {u16[]} - An array containing the retrieved u16 values.
     */
    @inline
    public getAll(startIndex: u64, count: u64): u16[] {
        assert(startIndex + count <= this._length, 'Requested range exceeds array length');

        if (u32.MAX_VALUE < count) {
            throw new Revert('Requested range exceeds maximum allowed value.');
        }

        const result: u16[] = new Array<u16>(count as u32);
        for (let i: u64 = 0; i < count; i++) {
            result[i as u32] = this.get(startIndex + i);
        }
        return result;
    }

    /**
     * @method toString
     * @description Returns a string representation of all cached u16 values.
     * @returns {string} - A string in the format "[value0, value1, ..., valueN]".
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
        const slotCount: u64 = (this._length + 15) / 16;

        for (let slotIndex: u64 = 0; slotIndex < slotCount; slotIndex++) {
            this.ensureValues(slotIndex);
            const packed = this.packValues(slotIndex);
            const slotBytes = packed.toBytes();
            for (let i: u32 = 0; i < slotBytes.length; i++) {
                bytes.push(slotBytes[i]);
            }
        }
        return bytes;
    }

    /**
     * @method reset
     * @description Resets all cached u16 values to zero and marks them as changed, including resetting the length and startIndex.
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
     * @description Loads and caches the u16 values from the specified storage slot.
     * @param {u64} slotIndex - The index of the storage slot.
     */
    private ensureValues(slotIndex: u64): void {
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
     * @description Packs the sixteen cached u16 values into a single u256 for storage.
     * @param {u64} slotIndex - The index of the storage slot.
     * @returns {u256} - The packed u256 value.
     */
    private packValues(slotIndex: u64): u256 {
        const values = this._values.get(slotIndex);
        if (!values) {
            return u256.Zero;
        }
        const packed = new u256();

        // Pack values[0..3] into lo1
        packed.lo1 =
            (u64(values[0]) << 48) |
            (u64(values[1]) << 32) |
            (u64(values[2]) << 16) |
            u64(values[3]);

        // Pack values[4..7] into lo2
        packed.lo2 =
            (u64(values[4]) << 48) |
            (u64(values[5]) << 32) |
            (u64(values[6]) << 16) |
            u64(values[7]);

        // Pack values[8..11] into hi1
        packed.hi1 =
            (u64(values[8]) << 48) |
            (u64(values[9]) << 32) |
            (u64(values[10]) << 16) |
            u64(values[11]);

        // Pack values[12..15] into hi2
        packed.hi2 =
            (u64(values[12]) << 48) |
            (u64(values[13]) << 32) |
            (u64(values[14]) << 16) |
            u64(values[15]);

        return packed;
    }

    /**
     * @private
     * @method unpackU256
     * @description Unpacks a u256 value into an array of sixteen u16s.
     * @param {u256} storedU256 - The u256 value to unpack.
     * @returns {u16[]} - An array of sixteen u16 values.
     */
    private unpackU256(storedU256: u256): u16[] {
        const values: u16[] = new Array<u16>(16);

        // Unpack lo1 into values[0..3]
        values[0] = u16(storedU256.lo1 >> 48);
        values[1] = u16((storedU256.lo1 >> 32) & 0xffff);
        values[2] = u16((storedU256.lo1 >> 16) & 0xffff);
        values[3] = u16(storedU256.lo1 & 0xffff);

        // Unpack lo2 into values[4..7]
        values[4] = u16(storedU256.lo2 >> 48);
        values[5] = u16((storedU256.lo2 >> 32) & 0xffff);
        values[6] = u16((storedU256.lo2 >> 16) & 0xffff);
        values[7] = u16(storedU256.lo2 & 0xffff);

        // Unpack hi1 into values[8..11]
        values[8] = u16(storedU256.hi1 >> 48);
        values[9] = u16((storedU256.hi1 >> 32) & 0xffff);
        values[10] = u16((storedU256.hi1 >> 16) & 0xffff);
        values[11] = u16(storedU256.hi1 & 0xffff);

        // Unpack hi2 into values[12..15]
        values[12] = u16(storedU256.hi2 >> 48);
        values[13] = u16((storedU256.hi2 >> 32) & 0xffff);
        values[14] = u16((storedU256.hi2 >> 16) & 0xffff);
        values[15] = u16(storedU256.hi2 & 0xffff);

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
        // Each slot is identified by baseU256Pointer + slotIndex + 1
        return SafeMath.add(this.baseU256Pointer, u256.fromU64(slotIndex + 1));
    }
}
