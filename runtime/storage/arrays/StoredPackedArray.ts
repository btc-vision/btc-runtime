import {
    bigEndianAdd,
    encodeBasePointer,
    GET_EMPTY_BUFFER,
    readLengthAndStartIndex,
    writeLengthAndStartIndex,
} from '../../math/bytes';
import { Blockchain } from '../../env';
import { Revert } from '../../types/Revert';

/**
 * Abstract base class for an array of T values that are packed
 * in 32-byte (Uint8Array) "slots" in storage.
 *
 * - Tracks length + startIndex in the first 16 bytes of `lengthPointer`.
 * - Maps each global index to (slotIndex, subIndex).
 * - Child classes define how many T items fit per 32-byte slot
 *   and how to pack/unpack them.
 */
export abstract class StoredPackedArray<T> {
    /** 32-byte base pointer (used to derive storage keys). */
    protected readonly basePointer: Uint8Array;

    /** Same pointer used to read/write length + startIndex. */
    protected readonly lengthPointer: Uint8Array;

    /** Internal length of the array. */
    protected _length: u64 = 0;

    /** Optional "start index" if needed by your logic. */
    protected _startIndex: u64 = 0;

    /** Whether length or startIndex changed. */
    protected _isChangedLength: bool = false;
    protected _isChangedStartIndex: bool = false;

    /**
     * A map from slotIndex => the 32-byte slot data in memory.
     * Child classes will parse that 32 bytes into an array of T, or vice versa.
     */
    protected _slots: Map<u64, Uint8Array> = new Map();

    /** Track which slotIndexes are changed and need saving. */
    protected _isChanged: Set<u64> = new Set();

    /**
     * Maximum length to prevent unbounded usage.
     * Adjust to fit your constraints (e.g. `u64.MAX_VALUE`).
     */
    protected readonly MAX_LENGTH: u64 = <u64>(u32.MAX_VALUE - 1);

    protected constructor(public pointer: u16, public subPointer: Uint8Array, protected defaultValue: T) {
        assert(subPointer.length <= 30, `You must pass a 30 bytes sub-pointer. (Array, got ${subPointer.length})`);

        const basePointer = encodeBasePointer(pointer, subPointer);
        this.lengthPointer = Uint8Array.wrap(basePointer.buffer);
        this.basePointer = bigEndianAdd(basePointer, 1);

        const storedLenStart = Blockchain.getStorageAt(basePointer);
        const data = readLengthAndStartIndex(storedLenStart);

        this._length = data[0];
        this._startIndex = data[1];
    }

    @inline
    @operator('[]')
    public get(index: u64): T {
        // max length used on purpose to prevent unbounded usage
        if (index > this.MAX_LENGTH) {
            throw new Revert('get: out of range');
        }

        const realIndex = (this._startIndex + index) % this.MAX_LENGTH;
        const cap = this.getSlotCapacity();
        const slotIndex = realIndex / cap;
        const subIndex = <u32>(realIndex % cap);

        const slotData = this.ensureSlot(slotIndex);
        const arr = this.unpackSlot(slotData);

        return arr[subIndex];
    }

    @inline
    public get_physical(index: u64): T {
        if (index > this.MAX_LENGTH) {
            throw new Revert('get: index exceeds MAX_LENGTH (packed array)');
        }

        const cap = this.getSlotCapacity();
        const slotIndex = index / cap;
        const subIndex = <u32>(index % cap);

        const slotData = this.ensureSlot(slotIndex);
        const arr = this.unpackSlot(slotData);

        return arr[subIndex];
    }

    @inline
    @operator('[]=')
    public set(index: u64, value: T): void {
        if (index > this.MAX_LENGTH) {
            throw new Revert('set: index exceeds MAX_LENGTH (packed array)');
        }

        const realIndex = (this._startIndex + index) % this.MAX_LENGTH;
        const cap = this.getSlotCapacity();
        const slotIndex = realIndex / cap;
        const subIndex = <u32>(realIndex % cap);

        let slotData = this.ensureSlot(slotIndex);
        const arr = this.unpackSlot(slotData);

        if (!this.eq(arr[subIndex], value)) {
            arr[subIndex] = value;
            slotData = this.packSlot(arr);
            this._slots.set(slotIndex, slotData);
            this._isChanged.add(slotIndex);
        }
    }

    @inline
    public set_physical(index: u64, value: T): void {
        if (index > this.MAX_LENGTH) {
            throw new Revert('set: index exceeds MAX_LENGTH (packed array)');
        }

        const cap = this.getSlotCapacity();
        const slotIndex = index / cap;
        const subIndex = <u32>(index % cap);

        let slotData = this.ensureSlot(slotIndex);
        const arr = this.unpackSlot(slotData);

        if (!this.eq(arr[subIndex], value)) {
            arr[subIndex] = value;
            slotData = this.packSlot(arr);
            this._slots.set(slotIndex, slotData);
            this._isChanged.add(slotIndex);
        }
    }

    @inline
    public push(value: T, isPhysical: bool = false): void {
        if (this._length >= this.MAX_LENGTH) {
            throw new Revert('push: array has reached MAX_LENGTH');
        }

        const realIndex = ((isPhysical ? 0 : this._startIndex) + this._length) % this.MAX_LENGTH;
        const cap = this.getSlotCapacity();
        const slotIndex = realIndex / cap;
        const subIndex = <u32>(realIndex % cap);

        let slotData = this.ensureSlot(slotIndex);
        const arr = this.unpackSlot(slotData);

        if (!this.eq(arr[subIndex], value)) {
            arr[subIndex] = value;
            slotData = this.packSlot(arr);
            this._slots.set(slotIndex, slotData);
            this._isChanged.add(slotIndex);
        }

        this._length += 1;
        this._isChangedLength = true;
    }

    /**
     * Remove the first element by zeroing it and shifting all other elements.
     */
    @inline
    public shift(): T {
        if (this._length == 0) {
            throw new Revert('shift: array is empty (packed array)');
        }

        const newIndex = this._startIndex;
        const cap = this.getSlotCapacity();
        const slotIndex = newIndex / cap;
        const subIndex = <u32>(newIndex % cap);

        let slotData = this.ensureSlot(slotIndex);

        const arr = this.unpackSlot(slotData);
        const currentData = arr[subIndex];

        if (!this.eq(currentData, this.defaultValue)) {
            arr[subIndex] = this.defaultValue;
            slotData = this.packSlot(arr);

            this._slots.set(slotIndex, slotData);
            this._isChanged.add(slotIndex);
        }

        this._length -= 1;
        this._startIndex += 1;
        this._isChangedLength = true;
        this._isChangedStartIndex = true;

        return currentData;
    }

    /**
     * "Delete" by zeroing out the element at `index`,
     * but does not reduce the length.
     */
    @inline
    public delete(index: u64): void {
        const realIndex = (this._startIndex + index) % this.MAX_LENGTH;
        const cap = this.getSlotCapacity();
        const slotIndex = realIndex / cap;
        const subIndex = <u32>(realIndex % cap);

        let slotData = this.ensureSlot(slotIndex);
        const arr = this.unpackSlot(slotData);

        const zeroVal = this.zeroValue();
        if (!this.eq(arr[subIndex], zeroVal)) {
            arr[subIndex] = zeroVal;
            slotData = this.packSlot(arr);
            this._slots.set(slotIndex, slotData);
            this._isChanged.add(slotIndex);
        }
    }

    /**
     * "Delete" by zeroing out the element at `index`,
     * but does not reduce the length.
     */
    @inline
    public delete_physical(index: u64): void {
        const cap = this.getSlotCapacity();
        const slotIndex = index / cap;
        const subIndex = <u32>(index % cap);

        let slotData = this.ensureSlot(slotIndex);
        const arr = this.unpackSlot(slotData);

        const zeroVal = this.zeroValue();
        if (!this.eq(arr[subIndex], zeroVal)) {
            arr[subIndex] = zeroVal;
            slotData = this.packSlot(arr);
            this._slots.set(slotIndex, slotData);
            this._isChanged.add(slotIndex);
        }
    }

    /**
     * Remove the last element by zeroing it and decrementing length by 1.
     */
    @inline
    public deleteLast(): void {
        if (this._length == 0) {
            throw new Revert('deleteLast: array is empty (packed array)');
        }

        const lastIndex = this._length - 1;
        this.delete(lastIndex);

        this._length -= 1;
        this._isChangedLength = true;
    }

    @inline
    public setMultiple(startIndex: u64, values: T[]): void {
        const end = startIndex + <u64>values.length;
        if (end > this._length) {
            throw new Revert('setMultiple: out of range (packed array)');
        }

        for (let i = 0; i < values.length; i++) {
            this.set(startIndex + <u64>i, values[i]);
        }
    }

    // -----------------------------------------------------------
    //              Public Array-Like Methods
    // -----------------------------------------------------------
    @inline
    public getAll(startIndex: u64, count: u64): T[] {
        if (count > <u64>u32.MAX_VALUE) {
            throw new Revert('getAll: count too large (packed array)');
        }

        const out = new Array<T>(<i32>count);
        for (let i: u64 = 0; i < count; i++) {
            out[<i32>i] = this.get(startIndex + i);
        }

        return out;
    }

    @inline
    public getLength(): u64 {
        return this._length;
    }

    @inline
    public startingIndex(): u64 {
        return this._startIndex;
    }

    @inline
    public setStartingIndex(index: u64): void {
        this._startIndex = index;
        this._isChangedStartIndex = true;
    }

    /**
     * Return string "[v0, v1, ...]"
     */
    public toString(): string {
        let s = '[';
        for (let i: u64 = 0; i < this._length; i++) {
            s += `${this.get(i)}`;
            if (i < this._length - 1) {
                s += ', ';
            }
        }
        s += ']';
        return s;
    }

    public save(): void {
        const changed = this._isChanged.values();
        for (let i = 0; i < changed.length; i++) {
            const slotIndex = changed[i];
            const slotData = this._slots.get(slotIndex);
            if (slotData) {
                const ptr = this.calculateStoragePointer(slotIndex);
                Blockchain.setStorageAt(ptr, slotData);
            }
        }

        this._isChanged.clear();

        if (this._isChangedLength || this._isChangedStartIndex) {
            const encoded = writeLengthAndStartIndex(this._length, this._startIndex);
            Blockchain.setStorageAt(this.lengthPointer, encoded);
            this._isChangedLength = false;
            this._isChangedStartIndex = false;
        }
    }

    public deleteAll(): void {
        const keys = this._slots.keys();
        for (let i = 0; i < keys.length; i++) {
            const slotIndex = keys[i];
            const ptr = this.calculateStoragePointer(slotIndex);
            Blockchain.setStorageAt(ptr, GET_EMPTY_BUFFER()); // 32 bytes of zero
        }

        // Reset length + startIndex
        Blockchain.setStorageAt(this.lengthPointer, GET_EMPTY_BUFFER());

        this._length = 0;
        this._startIndex = 0;
        this._isChangedLength = false;
        this._isChangedStartIndex = false;
        this._slots.clear();
        this._isChanged.clear();
    }

    /**
     * Reset the array to its initial state.
     */
    public reset(): void {
        this._length = 0;
        this._startIndex = 0;
        this._isChangedLength = true;
        this._isChangedStartIndex = true;

        this._slots.clear();
        this._isChanged.clear();

        this.save();
    }

    /** Number of T items that fit in one 32-byte slot. */
    protected abstract getSlotCapacity(): u64;

    /** Return the "zero" value of type T. */
    protected abstract zeroValue(): T;

    /** Compare two T values for equality. */
    protected abstract eq(a: T, b: T): bool;

    // -----------------------------------------------------------
    //                 Persistence (save, reset, etc.)
    // -----------------------------------------------------------

    /**
     * Pack an array of T (length = getSlotCapacity()) into a 32-byte buffer.
     */
    protected abstract packSlot(values: T[]): Uint8Array;

    /**
     * Unpack a 32-byte buffer into an array of T (length = getSlotCapacity()).
     */
    protected abstract unpackSlot(slotData: Uint8Array): T[];

    /**
     * Calculate storage pointer for each slot index.
     * Typically "basePointer + (slotIndex+1)" in big-endian addition,
     * but you can do your own approach.
     */
    protected abstract calculateStoragePointer(slotIndex: u64): Uint8Array;

    // -----------------------------------------------------------
    //              Internal Slot-Loading Helpers
    // -----------------------------------------------------------

    /**
     * Ensure that slotIndex is loaded into _slots. If missing, read from storage.
     */
    protected ensureSlot(slotIndex: u64): Uint8Array {
        if (!this._slots.has(slotIndex)) {
            const ptr = this.calculateStoragePointer(slotIndex);
            const data = Blockchain.getStorageAt(ptr);

            // Must be exactly 32 bytes; if it's empty, you get 32 zero bytes from GET_EMPTY_BUFFER()
            this._slots.set(slotIndex, data);
        }

        return this._slots.get(slotIndex);
    }
}
