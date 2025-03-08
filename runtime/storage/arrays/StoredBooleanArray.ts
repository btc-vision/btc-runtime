import { BytesWriter } from '../../buffer/BytesWriter';
import { BytesReader } from '../../buffer/BytesReader';
import { Blockchain } from '../../env';
import { Revert } from '../../types/Revert';
import { addUint8ArraysBE, GET_EMPTY_BUFFER, getBit, setBit, u64ToBE32Bytes } from '../../math/bytes';

/**
 * @class StoredBooleanArray
 * Manages an array of boolean values across multiple storage slots.
 * Each slot is a 32-byte Uint8Array, each containing 256 bits (1 bit per boolean).
 *
 * For example:
 *  - slot 0 stores indexes [0..255]
 *  - slot 1 stores indexes [256..511]
 *  - ...
 */
@final
export class StoredBooleanArray {
    private readonly basePointer: Uint8Array;
    private readonly lengthPointer: Uint8Array;

    private _values: Map<u64, Uint8Array> = new Map();
    private _isChanged: Set<u64> = new Set();

    private _length: u64 = 0;
    private _startIndex: u64 = 0;
    private _isChangedLength: bool = false;
    private _isChangedStartIndex: bool = false;

    private readonly MAX_LENGTH: u64 = u32.MAX_VALUE;

    /**
     * @constructor
     * @param {u16} pointer       - The primary pointer identifier.
     * @param {Uint8Array} subPtr - The sub-pointer for memory slot addressing.
     *
     * The code below treats the first 16 bytes of `lengthPointer` as storing [length, startIndex].
     */
    constructor(
        public pointer: u16,
        public subPtr: Uint8Array,
    ) {
        const writer = new BytesWriter(32);
        writer.writeU16(pointer);
        writer.writeBytes(subPtr);

        const basePtr = writer.getBuffer();

        this.basePointer = basePtr;
        this.lengthPointer = basePtr;

        const storedLenStart: Uint8Array = Blockchain.getStorageAt(
            this.lengthPointer,
        );

        const r = new BytesReader(storedLenStart);
        this._length = r.readU64();
        this._startIndex = r.readU64();
    }

    // -------------- Public Accessors -------------- //

    /**
     * Retrieve boolean at `index`.
     */
    @inline
    public get(index: u64): bool {
        if (index > this.MAX_LENGTH) {
            throw new Revert('get: Index exceeds maximum allowed value.');
        }
        const slotIndex = index / 256;      // which 32-byte slot
        const bitIndex = <u16>(index % 256);

        this.ensureSlotLoaded(slotIndex);

        const slotValue = this._values.get(slotIndex);
        return slotValue ? getBit(slotValue, bitIndex) : false;
    }

    /**
     * Set boolean at `index`.
     */
    @inline
    public set(index: u64, value: bool): void {
        if (index > this.MAX_LENGTH) {
            throw new Revert('set: Index exceeds maximum allowed value.');
        }
        const slotIndex = index / 256;
        const bitIndex = <u16>(index % 256);

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
    public push(value: bool): void {
        if (this._length >= this.MAX_LENGTH) {
            throw new Revert('push: Reached max allowed length');
        }

        const newIndex = this._length;
        const effectiveIndex = this._startIndex + newIndex;
        const wrappedIndex = effectiveIndex < this.MAX_LENGTH
            ? effectiveIndex
            : effectiveIndex % this.MAX_LENGTH;

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
    }

    /**
     * Delete the boolean at `index` by setting it to false.
     */
    @inline
    public delete(index: u64): void {
        if (index > this.MAX_LENGTH) {
            throw new Revert('delete: Index exceeds maximum allowed value.');
        }
        const slotIndex = index / 256;
        const bitIndex = <u16>(index % 256);

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

    /**
     * Remove the last element by setting it false and decrementing length.
     */
    @inline
    public deleteLast(): void {
        if (this._length === 0) {
            throw new Revert('deleteLast: Array is empty');
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

        // 2) If length or startIndex changed, store them
        if (this._isChangedLength || this._isChangedStartIndex) {
            const w = new BytesWriter(16);
            w.writeU64(this._length);
            w.writeU64(this._startIndex);

            const data = w.getBuffer(); // 16 bytes
            // You could store 32 bytes if you prefer; the leftover bytes can be 0
            Blockchain.setStorageAt(this.lengthPointer, data);

            this._isChangedLength = false;
            this._isChangedStartIndex = false;
        }
    }

    /**
     * Delete all slots in storage (that are loaded) + reset length + startIndex.
     */
    @inline
    public deleteAll(): void {
        // clear all loaded slots
        const keys = this._values.keys();
        const zeroArr = GET_EMPTY_BUFFER();
        for (let i = 0; i < keys.length; i++) {
            const slotIndex = keys[i];
            const storagePointer = this.calculateStoragePointer(slotIndex);
            Blockchain.setStorageAt(storagePointer, zeroArr);
        }

        // also reset length + startIndex in storage
        const writer = new BytesWriter(16);
        writer.writeU64(0);
        writer.writeU64(0);
        Blockchain.setStorageAt(this.lengthPointer, writer.getBuffer());

        // reset in memory
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
    public setMultiple(startIndex: u64, values: bool[]): void {
        for (let i: u64 = 0; i < values.length; i++) {
            this.set(startIndex + i, values[i]);
        }
    }

    /**
     * Retrieve a batch of bools.
     */
    @inline
    public getAll(startIndex: u64, count: u64): bool[] {
        if (startIndex + count > this._length) {
            throw new Revert('getAll: range exceeds array length');
        }
        if (count > u64(u32.MAX_VALUE)) {
            throw new Revert('getAll: range exceeds max allowed');
        }

        const result = new Array<bool>(<i32>count);
        for (let i: u64 = 0; i < count; i++) {
            result[<i32>i] = this.get(startIndex + i);
        }
        return result;
    }

    /**
     * Print out the array as "[true, false, ...]".
     */
    @inline
    public toString(): string {
        let s = '[';
        for (let i: u64 = 0; i < this._length; i++) {
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
    public getLength(): u64 {
        return this._length;
    }

    /**
     * Current starting index for the array.
     */
    @inline
    public startingIndex(): u64 {
        return this._startIndex;
    }


    /**
     * Ensure the 32-byte slot for `slotIndex` is loaded into _values.
     */
    private ensureSlotLoaded(slotIndex: u64): void {
        if (!this._values.has(slotIndex)) {
            const pointer = this.calculateStoragePointer(slotIndex);
            const stored = Blockchain.getStorageAt(pointer);
            this._values.set(slotIndex, stored);
        }
    }

    /**
     * Convert `slotIndex` -> pointer = basePointer + (slotIndex + 1), as big-endian addition.
     */
    private calculateStoragePointer(slotIndex: u64): Uint8Array {
        const offset = u64ToBE32Bytes(slotIndex + 1);
        return addUint8ArraysBE(this.basePointer, offset);
    }
}
