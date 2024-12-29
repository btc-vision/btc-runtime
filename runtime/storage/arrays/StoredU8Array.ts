import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesWriter } from '../../buffer/BytesWriter';
import { Blockchain } from '../../env';
import { Revert } from '../../types/Revert';
import { SafeMath } from '../../types/SafeMath';

/**
 * @class StoredU8Array
 * @description Manages an array of u8 values across multiple storage slots. Each slot holds thirty-two u8 values packed into a u256.
 */
@final
export class StoredU8Array {
    private readonly baseU256Pointer: u256;
    private readonly lengthPointer: u256;

    // Internal cache for storage slots
    private _values: Map<u64, u8[]> = new Map(); // Map from slotIndex to array of thirty-two u8s
    private _isLoaded: Set<u64> = new Set(); // Set of slotIndexes that are loaded
    private _isChanged: Set<u64> = new Set(); // Set of slotIndexes that are modified

    // Internal variables for length and startIndex management
    private _length: u64 = 0; // Current length of the array
    private _startIndex: u64 = 0; // Starting index of the array
    private _isChangedLength: bool = false;
    private _isChangedStartIndex: bool = false;

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
     * @description Retrieves the u8 value at the specified global index.
     * @param {u64} index - The global index (0 to ∞) of the u8 value to retrieve.
     * @returns {u8} - The u8 value at the specified index.
     */
    @inline
    public get(index: u64): u8 {
        assert(index < this._length, 'Index out of bounds');

        const slotIndex: u64 = index / 32; // Each slot holds thirty-two u8s
        const subIndex: u8 = <u8>(index % 32);
        this.ensureValues(slotIndex);
        const slotValues = this._values.get(slotIndex);
        return slotValues ? slotValues[subIndex] : 0;
    }

    /**
     * @method set
     * @description Sets the u8 value at the specified global index.
     * @param {u64} index - The global index (0 to ∞) of the u8 value to set.
     * @param {u8} value - The u8 value to assign.
     */
    @inline
    public set(index: u64, value: u8): void {
        assert(index < this._length, 'Index exceeds current array length');

        const slotIndex: u64 = index / 32;
        const subIndex: u8 = <u8>(index % 32);
        this.ensureValues(slotIndex);

        const slotValues = this._values.get(slotIndex);
        if (slotValues && slotValues[subIndex] !== value) {
            slotValues[subIndex] = value;
            this._isChanged.add(slotIndex);
        }
    }

    /**
     * @method push
     * @description Appends a new u8 value to the end of the array.
     * @param {u8} value - The u8 value to append.
     */
    public push(value: u8): void {
        if (this._length >= this.MAX_LENGTH) {
            throw new Revert(
                'Push operation failed: Array has reached its maximum allowed length.',
            );
        }

        const newIndex: u64 = this._length;
        const wrappedIndex: u64 =
            newIndex < this.MAX_LENGTH ? newIndex : newIndex % this.MAX_LENGTH;

        const slotIndex: u64 = wrappedIndex / 32;
        const subIndex: u8 = <u8>(wrappedIndex % 32);

        this.ensureValues(slotIndex);

        const slotValues = this._values.get(slotIndex);
        if (slotValues) {
            slotValues[subIndex] = value;
            this._isChanged.add(slotIndex);
        }

        this._length += 1;
        this._isChangedLength = true;
    }

    /**
     * @method delete
     * @description Deletes the u8 value at the specified index by setting it to zero. Does not reorder the array.
     * @param {u64} index - The global index of the u8 value to delete.
     */
    public delete(index: u64): void {
        if (index >= this._length) {
            throw new Revert('Delete operation failed: Index out of bounds.');
        }

        const slotIndex: u64 = index / 32;
        const subIndex: u8 = <u8>(index % 32);
        this.ensureValues(slotIndex);

        const slotValues = this._values.get(slotIndex);
        if (slotValues && slotValues[subIndex] !== 0) {
            slotValues[subIndex] = 0;
            this._isChanged.add(slotIndex);
        }
    }

    /**
     * @method shift
     * @description Removes the first element of the array by setting it to zero, decrementing the length,
     *              and incrementing the startIndex (with wrap-around if needed).
     */
    public shift(): void {
        if (this._length === 0) {
            throw new Revert('Shift operation failed: Array is empty.');
        }

        const currentStartIndex: u64 = this._startIndex;
        const slotIndex: u64 = currentStartIndex / 32;
        const subIndex: u8 = <u8>(currentStartIndex % 32);
        this.ensureValues(slotIndex);

        const slotValues = this._values.get(slotIndex);
        if (slotValues && slotValues[subIndex] !== 0) {
            slotValues[subIndex] = 0;
            this._isChanged.add(slotIndex);
        }

        this._length -= 1;
        this._isChangedLength = true;

        if (this._startIndex < this.MAX_LENGTH - 1) {
            this._startIndex += 1;
        } else {
            this._startIndex = 0;
        }
        this._isChangedStartIndex = true;
    }

    /**
     * @method save
     * @description Persists all cached u8 values, the length, and the startIndex to their respective storage slots if any have been modified.
     */
    public save(): void {
        // Save all changed slots
        const changedSlots = this._isChanged.values();
        for (let i = 0; i < changedSlots.length; i++) {
            const slotIndex = changedSlots[i];
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

        // Reset length and startIndex
        Blockchain.setStorageAt(this.lengthPointer, u256.Zero);
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
     * @description Sets multiple u8 values starting from a specific global index.
     * @param {u64} startIndex - The starting global index.
     * @param {u8[]} values - An array of u8 values to set.
     */
    @inline
    public setMultiple(startIndex: u64, values: u8[]): void {
        for (let i: u64 = 0; i < values.length; i++) {
            this.set(startIndex + i, values[i]);
        }
    }

    /**
     * @method getAll
     * @description Retrieves a range of u8 values starting from a specific global index.
     * @param {u64} startIndex - The starting global index.
     * @param {u64} count - The number of u8 values to retrieve.
     * @returns {u8[]} - An array containing the retrieved u8 values.
     */
    @inline
    public getAll(startIndex: u64, count: u64): u8[] {
        assert(startIndex + count <= this._length, 'Requested range exceeds array length');
        if (u32.MAX_VALUE < count) {
            throw new Revert('Requested range exceeds maximum allowed value.');
        }

        const result: u8[] = new Array<u8>(count as u32);
        for (let i: u64 = 0; i < count; i++) {
            result[i as u32] = this.get(startIndex + i);
        }
        return result;
    }

    /**
     * @method toString
     * @description Returns a string representation of all cached u8 values.
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
        const slotCount: u64 = (this._length + 31) / 32;

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
     * @description Resets all cached u8 values to zero and marks them as changed, including resetting the length and startIndex.
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
     * @method setLength
     * @description Sets the length of the array.
     * @param {u64} newLength - The new length to set.
     */
    public setLength(newLength: u64): void {
        if (newLength > this.MAX_LENGTH) {
            throw new Revert('SetLength operation failed: Length exceeds maximum allowed value.');
        }

        // If newLength is bigger than _startIndex, adjust startIndex
        if (newLength > this._startIndex) {
            this._startIndex = newLength;
            this._isChangedStartIndex = true;
        }

        this._length = newLength;
        this._isChangedLength = true;
    }

    /**
     * @method deleteLast
     * @description Removes the last element of the array by setting it to zero and decrementing the length.
     */
    public deleteLast(): void {
        if (this._length === 0) {
            throw new Revert('DeleteLast operation failed: Array is empty.');
        }

        const index = this._length - 1;
        this.delete(index);

        this._length -= 1;
        this._isChangedLength = true;
    }

    /**
     * @private
     * @method ensureValues
     * @description Loads and caches the u8 values from the specified storage slot if not already loaded.
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
     * @description Packs the thirty-two cached u8 values into a single u256 for storage.
     * @param {u64} slotIndex - The index of the storage slot.
     * @returns {u256} - The packed u256 value.
     */
    private packValues(slotIndex: u64): u256 {
        const values = this._values.get(slotIndex);
        if (!values) {
            return u256.Zero;
        }
        const packed = new u256();

        // Pack values[0..7]   into lo1
        packed.lo1 =
            (u64(values[0]) << 56) |
            (u64(values[1]) << 48) |
            (u64(values[2]) << 40) |
            (u64(values[3]) << 32) |
            (u64(values[4]) << 24) |
            (u64(values[5]) << 16) |
            (u64(values[6]) << 8) |
            u64(values[7]);

        // Pack values[8..15]  into lo2
        packed.lo2 =
            (u64(values[8]) << 56) |
            (u64(values[9]) << 48) |
            (u64(values[10]) << 40) |
            (u64(values[11]) << 32) |
            (u64(values[12]) << 24) |
            (u64(values[13]) << 16) |
            (u64(values[14]) << 8) |
            u64(values[15]);

        // Pack values[16..23] into hi1
        packed.hi1 =
            (u64(values[16]) << 56) |
            (u64(values[17]) << 48) |
            (u64(values[18]) << 40) |
            (u64(values[19]) << 32) |
            (u64(values[20]) << 24) |
            (u64(values[21]) << 16) |
            (u64(values[22]) << 8) |
            u64(values[23]);

        // Pack values[24..31] into hi2
        packed.hi2 =
            (u64(values[24]) << 56) |
            (u64(values[25]) << 48) |
            (u64(values[26]) << 40) |
            (u64(values[27]) << 32) |
            (u64(values[28]) << 24) |
            (u64(values[29]) << 16) |
            (u64(values[30]) << 8) |
            u64(values[31]);

        return packed;
    }

    /**
     * @private
     * @method unpackU256
     * @description Unpacks a u256 value into an array of thirty-two u8s.
     * @param {u256} storedU256 - The u256 value to unpack.
     * @returns {u8[]} - An array of thirty-two u8 values.
     */
    private unpackU256(storedU256: u256): u8[] {
        const values: u8[] = new Array<u8>(32);

        // Unpack lo1 into values[0..7]
        values[0] = u8(storedU256.lo1 >> 56);
        values[1] = u8((storedU256.lo1 >> 48) & 0xff);
        values[2] = u8((storedU256.lo1 >> 40) & 0xff);
        values[3] = u8((storedU256.lo1 >> 32) & 0xff);
        values[4] = u8((storedU256.lo1 >> 24) & 0xff);
        values[5] = u8((storedU256.lo1 >> 16) & 0xff);
        values[6] = u8((storedU256.lo1 >> 8) & 0xff);
        values[7] = u8(storedU256.lo1 & 0xff);

        // Unpack lo2 into values[8..15]
        values[8] = u8(storedU256.lo2 >> 56);
        values[9] = u8((storedU256.lo2 >> 48) & 0xff);
        values[10] = u8((storedU256.lo2 >> 40) & 0xff);
        values[11] = u8((storedU256.lo2 >> 32) & 0xff);
        values[12] = u8((storedU256.lo2 >> 24) & 0xff);
        values[13] = u8((storedU256.lo2 >> 16) & 0xff);
        values[14] = u8((storedU256.lo2 >> 8) & 0xff);
        values[15] = u8(storedU256.lo2 & 0xff);

        // Unpack hi1 into values[16..23]
        values[16] = u8(storedU256.hi1 >> 56);
        values[17] = u8((storedU256.hi1 >> 48) & 0xff);
        values[18] = u8((storedU256.hi1 >> 40) & 0xff);
        values[19] = u8((storedU256.hi1 >> 32) & 0xff);
        values[20] = u8((storedU256.hi1 >> 24) & 0xff);
        values[21] = u8((storedU256.hi1 >> 16) & 0xff);
        values[22] = u8((storedU256.hi1 >> 8) & 0xff);
        values[23] = u8(storedU256.hi1 & 0xff);

        // Unpack hi2 into values[24..31]
        values[24] = u8(storedU256.hi2 >> 56);
        values[25] = u8((storedU256.hi2 >> 48) & 0xff);
        values[26] = u8((storedU256.hi2 >> 40) & 0xff);
        values[27] = u8((storedU256.hi2 >> 32) & 0xff);
        values[28] = u8((storedU256.hi2 >> 24) & 0xff);
        values[29] = u8((storedU256.hi2 >> 16) & 0xff);
        values[30] = u8((storedU256.hi2 >> 8) & 0xff);
        values[31] = u8(storedU256.hi2 & 0xff);

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
