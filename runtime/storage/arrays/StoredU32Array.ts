import { u256 } from '@btc-vision/as-bignum/assembly';
import { Blockchain } from '../../env';
import { BytesWriter } from '../../buffer/BytesWriter';
import { SafeMath } from '../../types/SafeMath';
import { Revert } from '../../types/Revert';

/**
 * @class StoredU32Array
 * @description Manages an array of u32 values across multiple storage slots.
 * Each slot holds **eight** u32 values packed into a single u256.
 */
@final
export class StoredU32Array {
    private readonly baseU256Pointer: u256;
    private readonly lengthPointer: u256;

    // Internal cache for storage slots
    private _values: Map<u64, u32[]> = new Map(); // Map from slotIndex to array of eight u32s
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
     * @param {u256} defaultValue - The default u256 value if storage is uninitialized.
     */
    constructor(
        public pointer: u16,
        public subPointer: Uint8Array,
        private defaultValue: u256,
    ) {
        // Initialize the base pointer using the primary pointer and subPointer
        const writer = new BytesWriter(32);
        writer.writeU16(pointer);
        writer.writeBytes(subPointer);

        const baseU256Pointer = u256.fromBytes(writer.getBuffer(), true);
        this.baseU256Pointer = baseU256Pointer;

        // We’ll reuse the same pointer for length & startIndex
        const lengthPointer = baseU256Pointer.clone();
        this.lengthPointer = lengthPointer;

        // Load current length + startIndex from storage
        const storedLengthAndStartIndex: u256 = Blockchain.getStorageAt(lengthPointer, u256.Zero);
        this._length = storedLengthAndStartIndex.lo1; // Bytes 0-7: length (u64)
        this._startIndex = storedLengthAndStartIndex.lo2; // Bytes 8-15: startIndex (u64)
    }

    /**
     * @method get
     * @description Retrieves the u32 value at the specified global index.
     * @param {u64} index - The global index (0 to ∞) of the u32 value to retrieve.
     * @returns {u32} - The u32 value at the specified index.
     */
    @inline
    public get(index: u64): u32 {
        const slotIndex: u64 = index / 8; // Each slot holds 8 u32s
        const subIndex: u8 = <u8>(index % 8); // 0..7

        this.ensureValues(slotIndex);

        const slotValues = this._values.get(slotIndex);
        return slotValues ? slotValues[subIndex] : 0;
    }

    /**
     * @method set
     * @description Sets the u32 value at the specified global index.
     * @param {u64} index - The global index (0 to ∞) of the u32 value to set.
     * @param {u32} value - The u32 value to assign.
     */
    @inline
    public set(index: u64, value: u32): void {
        if (index > this.MAX_LENGTH) {
            throw new Revert('Set operation failed: Index exceeds maximum allowed value.');
        }

        const slotIndex: u64 = index / 8;
        const subIndex: u8 = <u8>(index % 8);

        this.ensureValues(slotIndex);
        const slotValues = this._values.get(slotIndex);
        if (slotValues && slotValues[subIndex] !== value) {
            slotValues[subIndex] = value;
            this._isChanged.add(slotIndex);
        }
    }

    /**
     * @method push
     * @description Appends a new u32 value to the end of the array.
     * @param {u32} value - The u32 value to append.
     */
    public push(value: u32): void {
        if (this._length > this.MAX_LENGTH) {
            throw new Revert(
                'Push operation failed: Array has reached its maximum allowed length.',
            );
        }

        const newIndex: u64 = this._length;
        const wrappedIndex: u64 =
            newIndex < this.MAX_LENGTH ? newIndex : newIndex % this.MAX_LENGTH;

        const slotIndex: u64 = wrappedIndex / 8;
        const subIndex: u8 = <u8>(wrappedIndex % 8);

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
     * @description Deletes the u32 value at the specified index by setting it to zero (does not reorder).
     * @param {u64} index - The global index of the u32 value to delete.
     */
    public delete(index: u64): void {
        const slotIndex: u64 = index / 8;
        const subIndex: u8 = <u8>(index % 8);
        this.ensureValues(slotIndex);

        const slotValues = this._values.get(slotIndex);
        if (slotValues && slotValues[subIndex] !== 0) {
            slotValues[subIndex] = 0;
            this._isChanged.add(slotIndex);
        }
    }

    /**
     * @method shift
     * @description Removes the first element of the array by zeroing it out, decrementing length,
     * and incrementing the startIndex (with wrap-around).
     */
    public shift(): void {
        if (this._length === 0) {
            throw new Revert('Shift operation failed: Array is empty.');
        }

        const currentStartIndex: u64 = this._startIndex;
        const slotIndex: u64 = currentStartIndex / 8;
        const subIndex: u8 = <u8>(currentStartIndex % 8);

        this.ensureValues(slotIndex);
        const slotValues = this._values.get(slotIndex);
        if (slotValues && slotValues[subIndex] !== 0) {
            slotValues[subIndex] = 0;
            this._isChanged.add(slotIndex);
        }

        // Decrement length
        this._length -= 1;
        this._isChangedLength = true;

        // Increment startIndex with wrap-around
        if (this._startIndex < this.MAX_LENGTH - 1) {
            this._startIndex += 1;
        } else {
            this._startIndex = 0;
        }
        this._isChangedStartIndex = true;
    }

    /**
     * @method save
     * @description Persists all modified slots and the current length/startIndex into storage.
     */
    public save(): void {
        // Save changed slots
        const changedSlots = this._isChanged.values();
        for (let i = 0; i < changedSlots.length; i++) {
            const slotIndex = changedSlots[i];
            const packed = this.packValues(slotIndex);
            const storagePointer = this.calculateStoragePointer(slotIndex);
            Blockchain.setStorageAt(storagePointer, packed);
        }
        this._isChanged.clear();

        // Save length + startIndex if changed
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
     * @description Deletes all storage slots and resets length/startIndex to zero.
     */
    public deleteAll(): void {
        // Clear loaded slots from storage
        const keys = this._values.keys();
        for (let i = 0; i < keys.length; i++) {
            const slotIndex = keys[i];
            const storagePointer = this.calculateStoragePointer(slotIndex);
            Blockchain.setStorageAt(storagePointer, u256.Zero);
        }

        // Reset length + startIndex
        Blockchain.setStorageAt(this.lengthPointer, u256.Zero);
        this._length = 0;
        this._startIndex = 0;
        this._isChangedLength = false;
        this._isChangedStartIndex = false;

        // Clear caches
        this._values.clear();
        this._isLoaded.clear();
        this._isChanged.clear();
    }

    /**
     * @method setMultiple
     * @description Sets multiple u32 values starting at a given global index.
     * @param {u64} startIndex - The starting global index.
     * @param {u32[]} values - The array of u32 values to set.
     */
    @inline
    public setMultiple(startIndex: u64, values: u32[]): void {
        for (let i: u64 = 0; i < values.length; i++) {
            this.set(startIndex + i, values[i]);
        }
    }

    /**
     * @method getAll
     * @description Retrieves a consecutive range of u32 values starting at a given global index.
     * @param {u64} startIndex - The starting global index.
     * @param {u64} count - The number of u32 values to retrieve.
     * @returns {u32[]} - The requested slice of the array.
     */
    @inline
    public getAll(startIndex: u64, count: u64): u32[] {
        if ((startIndex + count) > this._length) {
            throw new Revert('Requested range exceeds array length');
        }

        if (u32.MAX_VALUE < count) {
            throw new Revert('Requested range exceeds maximum allowed value.');
        }

        const result: u32[] = new Array<u32>(count as u32);
        for (let i: u64 = 0; i < count; i++) {
            result[i as u32] = this.get(startIndex + i);
        }
        return result;
    }

    /**
     * @method toString
     * @description Returns a string representation of all cached u32 values.
     * @returns {string} - A string in the format "[val0, val1, ..., valN]".
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
     * @description Packs all cached slots into u256 and returns them as a byte array.
     * @returns {u8[]} - The packed u256 values in byte form.
     */
    @inline
    public toBytes(): u8[] {
        const bytes: u8[] = new Array<u8>();
        const slotCount: u64 = (this._length + 7) / 8; // each slot has 8 values

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
     * @description Zeros out the entire array and resets length/startIndex to zero, persisting changes immediately.
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
     * @description Returns the current length of the array.
     * @returns {u64} - The length.
     */
    @inline
    public getLength(): u64 {
        return this._length;
    }

    /**
     * @method startingIndex
     * @description Returns the current starting index of the array.
     * @returns {u64} - The startIndex.
     */
    @inline
    public startingIndex(): u64 {
        return this._startIndex;
    }

    /**
     * @method deleteLast
     * @description Deletes the last element of the array by setting it to zero and decrementing the length.
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
     * @description Loads the slot data from storage if not already in cache.
     * @param {u64} slotIndex - The slot index.
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
     * @description Packs eight u32 values into a single u256 (lo1, lo2, hi1, hi2).
     * @param {u64} slotIndex - The slot index.
     * @returns {u256} - The packed u256.
     */
    private packValues(slotIndex: u64): u256 {
        const values = this._values.get(slotIndex);
        if (!values) {
            return u256.Zero;
        }
        const packed = new u256();

        // Each 64 bits can store two u32:
        // lo1 = (values[0], values[1])
        // lo2 = (values[2], values[3])
        // hi1 = (values[4], values[5])
        // hi2 = (values[6], values[7])

        // Pack into lo1
        packed.lo1 = (u64(values[0]) << 32) | (u64(values[1]) & 0xffffffff);

        // Pack into lo2
        packed.lo2 = (u64(values[2]) << 32) | (u64(values[3]) & 0xffffffff);

        // Pack into hi1
        packed.hi1 = (u64(values[4]) << 32) | (u64(values[5]) & 0xffffffff);

        // Pack into hi2
        packed.hi2 = (u64(values[6]) << 32) | (u64(values[7]) & 0xffffffff);

        return packed;
    }

    /**
     * @private
     * @method unpackU256
     * @description Unpacks a u256 into an array of eight u32 values.
     * @param {u256} storedU256 - The stored u256 data.
     * @returns {u32[]} - The array of eight u32s.
     */
    private unpackU256(storedU256: u256): u32[] {
        const values: u32[] = new Array<u32>(8);

        // Extract each pair of u32 from lo1, lo2, hi1, hi2
        values[0] = u32(storedU256.lo1 >> 32);
        values[1] = u32(storedU256.lo1 & 0xffffffff);

        values[2] = u32(storedU256.lo2 >> 32);
        values[3] = u32(storedU256.lo2 & 0xffffffff);

        values[4] = u32(storedU256.hi1 >> 32);
        values[5] = u32(storedU256.hi1 & 0xffffffff);

        values[6] = u32(storedU256.hi2 >> 32);
        values[7] = u32(storedU256.hi2 & 0xffffffff);

        return values;
    }

    /**
     * @private
     * @method calculateStoragePointer
     * @description Derives the storage pointer for a slot index by adding (slotIndex + 1) to the base pointer.
     * @param {u64} slotIndex - The slot index.
     * @returns {u256} - The resulting storage pointer.
     */
    private calculateStoragePointer(slotIndex: u64): u256 {
        // We offset by +1 so we don't collide with the length pointer (stored at basePointer itself).
        return SafeMath.add(this.baseU256Pointer, u256.fromU64(slotIndex + 1));
    }
}
