import { BytesWriter } from '../../buffer/BytesWriter';
import { Blockchain } from '../../env';
import { Revert } from '../../types/Revert';
import {
    addUint8ArraysBE,
    bigEndianAdd,
    GET_EMPTY_BUFFER,
    getBit,
    readLengthAndStartIndex,
    setBit,
    u64ToBE32Bytes,
} from '../../math/bytes';
import { DEFAULT_MAX_LENGTH } from './StoredPackedArray';
import { encodePointer } from '../../math/abi';

/**
 * @class StoredBooleanArray
 * Manages an array of boolean values across multiple storage slots.
 * Each slot is a 32-byte Uint8Array, each containing 256 bits (1 bit per boolean).
 *
 * For example:
 *  - slot 0 stores indexes [0..255]
 *  - slot 1 stores indexes [256..511]
 *  - ...
 *  Note: This is designed to wrap around.
 */
@final
export class StoredBooleanArray {
    private readonly basePointer: Uint8Array;
    private readonly lengthPointer: Uint8Array;

    private _values: Map<u32, Uint8Array> = new Map();
    private _isChanged: Set<u32> = new Set();

    private _length: u32 = 0;
    private _startIndex: u32 = 0;
    private _isChangedLength: bool = false;
    private _isChangedStartIndex: bool = false;

    private nextItemOffset: u32 = 0;

    /**
     * @constructor
     * @param {u16} pointer       - The primary pointer identifier.
     * @param {Uint8Array} subPtr - The sub-pointer for memory slot addressing.
     * @param {u32} [MAX_LENGTH=DEFAULT_MAX_LENGTH] - The maximum length of the array.
     *
     * The code below treats the first 16 bytes of `lengthPointer` as storing [length, startIndex].
     */
    constructor(
        public pointer: u16,
        public subPtr: Uint8Array,
        protected MAX_LENGTH: u32 = DEFAULT_MAX_LENGTH,
    ) {
        const basePointer = encodePointer(pointer, subPtr, true, 'StoredBooleanArray');
        this.lengthPointer = Uint8Array.wrap(basePointer.buffer);
        this.basePointer = bigEndianAdd(basePointer, 1);

        const storedLenStart = Blockchain.getStorageAt(basePointer);
        const data = readLengthAndStartIndex(storedLenStart);

        this._length = data[0];
        this._startIndex = data[1];
    }

    @inline
    public get previousOffset(): u32 {
        return <u32>(
            ((this._startIndex +
                <u64>(this.nextItemOffset === 0 ? this.nextItemOffset : this.nextItemOffset - 1)) %
                this.MAX_LENGTH)
        );
    }

    /**
     * Set the maximum length of the array.
     * This is a safety check to prevent unbounded usage.
     */
    @inline
    public setMaxLength(maxLength: u32): void {
        if (maxLength > this.MAX_LENGTH) {
            throw new Revert('setMaxLength: maxLength exceeds MAX_LENGTH');
        }

        this.MAX_LENGTH = maxLength;
    }

    @inline
    public has(index: u32): bool {
        return index < this._length;
    }

    /**
     * Get the next item in the array, starting from the current offset.
     * This is useful for iterating through the array.
     */
    @inline
    public next(): bool {
        const value = this.get(this.nextItemOffset);
        this.nextItemOffset += 1;

        return value;
    }

    /**
     * Apply the starting index with n offset.
     */
    @inline
    public applyNextOffsetToStartingIndex(): void {
        if (!this.nextItemOffset) return;

        this._startIndex += this.nextItemOffset - 1;
        this._isChangedStartIndex = true;
        this.nextItemOffset = 0;
    }

    @inline
    public incrementStartingIndex(): void {
        if (this._startIndex >= this.MAX_LENGTH) {
            this._startIndex = 0;
        } else {
            this._startIndex += 1;
        }

        this._isChangedStartIndex = true;
    }

    /**
     * Retrieve boolean at `index`.
     */
    @operator('[]')
    @inline
    public get(index: u32): bool {
        if (index >= this._length) {
            throw new Revert(
                `get: index out of range (${index} >= ${this._length}, boolean array)`,
            );
        }

        const wrappedIndex = this.getRealIndex(index);
        const slotIndex = wrappedIndex / 256;
        const bitIndex = <u16>(wrappedIndex % 256);

        this.ensureSlotLoaded(slotIndex);

        const slotValue = this._values.get(slotIndex);
        return slotValue ? getBit(slotValue, bitIndex) : false;
    }

    /**
     * Set boolean at `index`.
     */
    @operator('[]=')
    @inline
    public set(index: u32, value: bool): void {
        if (index >= this._length) {
            throw new Revert(
                `set: index out of range (${index} >= ${this._length}, boolean array)`,
            );
        }

        const wrappedIndex = this.getRealIndex(index);
        const slotIndex = wrappedIndex / 256;
        const bitIndex = <u16>(wrappedIndex % 256);

        this.ensureSlotLoaded(slotIndex);

        const slotValue = this._values.get(slotIndex);
        if (slotValue) {
            const oldVal = getBit(slotValue, bitIndex);
            if (oldVal != value) {
                setBit(slotValue, bitIndex, value);
                this._isChanged.add(slotIndex);
            }
        }
    }

    /**
     * Push a new boolean at the "end" of the array.
     */
    @inline
    public push(value: bool): u32 {
        if (this._length >= this.MAX_LENGTH) {
            throw new Revert('push: reached max allowed length (boolean array)');
        }

        const wrappedIndex = this.getRealIndex(this._length);
        const slotIndex = wrappedIndex / 256;
        const bitIndex = <u16>(wrappedIndex % 256);

        this.ensureSlotLoaded(slotIndex);

        const slotValue = this._values.get(slotIndex);
        if (slotValue) {
            setBit(slotValue, bitIndex, value);
            this._isChanged.add(slotIndex);
        }

        this._length += 1;
        this._isChangedLength = true;

        return wrappedIndex;
    }

    /**
     * Delete the boolean at `index` by setting it to false.
     */
    @inline
    public delete(index: u32): void {
        if (index >= this._length) {
            throw new Revert('delete: index out of range (boolean array)');
        }

        const wrappedIndex = this.getRealIndex(index);
        const slotIndex = wrappedIndex / 256;
        const bitIndex = <u16>(wrappedIndex % 256);

        this.ensureSlotLoaded(slotIndex);

        const slotValue = this._values.get(slotIndex);
        if (slotValue) {
            const oldVal = getBit(slotValue, bitIndex);
            if (oldVal) {
                setBit(slotValue, bitIndex, false);
                this._isChanged.add(slotIndex);
            }
        }
    }

    @inline
    public removeItemFromLength(): void {
        if (this._length == 0) {
            throw new Revert('delete: array is empty');
        }

        this._length -= 1;
        this._isChangedLength = true;
    }

    /**
     * Remove the last element by setting it false and decrementing length.
     */
    @inline
    public deleteLast(): void {
        if (this._length === 0) {
            throw new Revert('deleteLast: array is empty');
        }

        const lastIndex = this._length - 1;
        this.delete(lastIndex);

        this._length -= 1;
        this._isChangedLength = true;
    }

    /**
     * Commit any changed slots to storage, as well as length / startIndex if changed.
     */
    public save(): void {
        const changed = this._isChanged.values();
        for (let i = 0; i < changed.length; i++) {
            const slotIndex = changed[i];
            const slotValue = this._values.get(slotIndex);
            const storagePointer = this.calculateStoragePointer(slotIndex);

            Blockchain.setStorageAt(storagePointer, slotValue);
        }

        this._isChanged.clear();

        if (this._isChangedLength || this._isChangedStartIndex) {
            const w = new BytesWriter(32);
            w.writeU32(this._length);
            w.writeU32(this._startIndex);

            const data = w.getBuffer();
            Blockchain.setStorageAt(this.lengthPointer, data);

            this._isChangedLength = false;
            this._isChangedStartIndex = false;
        }
    }

    /**
     * Delete all slots in storage (that are loaded) + reset length + _startIndex.
     */
    @inline
    public deleteAll(): void {
        const keys = this._values.keys();
        const zeroArr = GET_EMPTY_BUFFER();
        for (let i = 0; i < keys.length; i++) {
            const slotIndex = keys[i];
            const storagePointer = this.calculateStoragePointer(slotIndex);
            Blockchain.setStorageAt(storagePointer, zeroArr);
        }

        const writer = new BytesWriter(32);
        Blockchain.setStorageAt(this.lengthPointer, writer.getBuffer());

        this._length = 0;
        this._startIndex = 0;
        this._isChangedLength = false;
        this._isChangedStartIndex = false;

        this._values.clear();
        this._isChanged.clear();
    }

    /**
     * Set multiple bools starting at `startIndex`.
     */
    @inline
    public setMultiple(startIndex: u32, values: bool[]): void {
        for (let i: u32 = 0; i < values.length; i++) {
            this.set(startIndex + i, values[i]);
        }
    }

    /**
     * Retrieve a batch of bools.
     */
    @inline
    public getAll(start: u32, count: u32): bool[] {
        if (start + count > this._length) {
            throw new Revert('getAll: range exceeds array length (boolean array)');
        }

        if (count > u32(u32.MAX_VALUE)) {
            throw new Revert('getAll: range exceeds max allowed (boolean array)');
        }

        const result = new Array<bool>(<i32>count);
        for (let i: u32 = 0; i < count; i++) {
            result[<i32>i] = this.get(start + i);
        }

        return result;
    }

    /**
     * Print out the array as "[true, false, ...]".
     */
    @inline
    public toString(): string {
        let s = '[';
        for (let i: u32 = 0; i < this._length; i++) {
            s += this.get(i).toString();
            if (i < this._length - 1) {
                s += ', ';
            }
        }
        s += ']';
        return s;
    }

    /**
     * Reset the array in memory (clear length, startIndex, caches), then save to storage.
     */
    @inline
    public reset(): void {
        this._length = 0;
        this._startIndex = 0;
        this._isChangedLength = true;
        this._isChangedStartIndex = true;

        this._values.clear();
        this._isChanged.clear();

        this.save();
    }

    /**
     * Current array length (number of booleans stored).
     */
    @inline
    public getLength(): u32 {
        return this._length;
    }

    @inline
    public setStartingIndex(index: u32): void {
        this._startIndex = index;
        this._isChangedStartIndex = true;
    }

    /**
     * Current starting index for the array.
     */
    @inline
    public startingIndex(): u32 {
        return this._startIndex;
    }

    private getRealIndex(index: u32): u32 {
        const maxLength: u64 = <u64>this.MAX_LENGTH;
        let realIndex: u64 = <u64>this._startIndex + <u64>index;
        if (!(realIndex < maxLength)) {
            realIndex %= maxLength;
        }

        return <u32>realIndex;
    }

    /**
     * Ensure the 32-byte slot for `slotIndex` is loaded into _values.
     */
    private ensureSlotLoaded(slotIndex: u32): void {
        if (!this._values.has(slotIndex)) {
            const pointer = this.calculateStoragePointer(slotIndex);
            const stored = Blockchain.getStorageAt(pointer);
            this._values.set(slotIndex, stored);
        }
    }

    /**
     * Convert `slotIndex` -> pointer = basePointer + (slotIndex + 1), as big-endian addition.
     */
    private calculateStoragePointer(slotIndex: u32): Uint8Array {
        const offset = u64ToBE32Bytes(slotIndex);
        return addUint8ArraysBE(this.basePointer, offset);
    }
}
