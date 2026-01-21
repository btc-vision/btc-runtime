import {
    bigEndianAdd,
    GET_EMPTY_BUFFER,
    readLengthAndStartIndex,
    writeLengthAndStartIndex,
} from '../../math/bytes';
import { Blockchain } from '../../env';
import { Revert } from '../../types/Revert';
import { encodePointer } from '../../math/abi';

export const DEFAULT_MAX_LENGTH: u32 = u32.MAX_VALUE - 1;

/**
 * Abstract base class for an array of T values that are packed
 * in 32-byte (Uint8Array) "slots" in storage.
 *
 * - Tracks length + startIndex in the first 16 bytes of `lengthPointer`.
 * - Maps each global index to (slotIndex, subIndex).
 * - Child classes define how many T items fit per 32-byte slot
 * and how to pack/unpack them.
 *
 * Note: This is designed to wrap around.
 *
 * **Optimizations:**
 * - Hot Slot Caching: Skips Map lookups for sequential access.
 * - Conditional Subtraction: Replaces expensive modulo (%) operations.
 */
export abstract class StoredPackedArray<T> {
    /** 32-byte base pointer (used to derive storage keys). */
    protected readonly basePointer: Uint8Array;

    /** Same pointer used to read/write length + startIndex. */
    protected readonly lengthPointer: Uint8Array;

    /** Internal length of the array. */
    protected _length: u32 = 0;

    /** Optional "start index" if needed by your logic. */
    protected _startIndex: u32 = 0;

    /** Whether length or startIndex changed. */
    protected _isChangedLength: bool = false;
    protected _isChangedStartIndex: bool = false;

    /**
     * A map from slotIndex => the 32-byte slot data in memory.
     * Child classes will parse that 32 bytes into an array of T, or vice versa.
     */
    protected _slots: Map<u32, Uint8Array> = new Map();

    /** Track which slotIndexes are changed and need saving. */
    protected _isChanged: Set<u32> = new Set();

    // --- OPTIMIZATION: HOT SLOT CACHE ---
    // Stores the last accessed slot index and data.
    // Prevents map lookups during sequential operations (iterating, pushing, etc).
    private _cachedSlotIndex: u32 = <u32>-1; // -1 indicates empty cache
    private _cachedSlotData: Uint8Array | null = null;

    private nextItemOffset: u32 = 0;

    protected constructor(
        public pointer: u16,
        public subPointer: Uint8Array,
        protected defaultValue: T,
        protected MAX_LENGTH: u32 = DEFAULT_MAX_LENGTH,
    ) {
        const basePointer = encodePointer(pointer, subPointer, true, 'StoredPackedArray');
        this.lengthPointer = Uint8Array.wrap(basePointer.buffer);
        this.basePointer = bigEndianAdd(basePointer, 1);

        const storedLenStart = Blockchain.getStorageAt(basePointer);
        const data = readLengthAndStartIndex(storedLenStart);

        this._length = data[0];
        this._startIndex = data[1];
    }

    @inline
    public get previousOffset(): u32 {
        // Optimization: Conditional subtraction logic is cleaner for gas,
        // but keeping modulo here for safety on the offset calculation logic.
        const offset = this.nextItemOffset === 0 ? this.nextItemOffset : this.nextItemOffset - 1;
        let val = <u64>this._startIndex + <u64>offset;
        const max = <u64>this.MAX_LENGTH;

        if (val >= max) val %= max;
        return <u32>val;
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
    @operator('[]')
    public get(index: u32): T {
        // max length used on purpose to prevent unbounded usage
        // we allow index to be equal to MAX_LENGTH because, we allow it on the set as well.
        if (index >= this.MAX_LENGTH) {
            throw new Revert('get: out of range');
        }

        const realIndex: u32 = this.getRealIndex(index);
        const cap: u32 = this.getSlotCapacity();

        const slotIndex = realIndex / cap;
        const subIndex = <u32>(realIndex % cap);

        // Optimization: Uses Hot Slot Cache
        const slotData = this.ensureSlot(slotIndex);
        const arr = this.unpackSlot(slotData);

        return unchecked(arr[subIndex]);
    }

    @inline
    public get_physical(index: u32): T {
        if (index >= this.MAX_LENGTH) {
            throw new Revert('get: index exceeds MAX_LENGTH (packed array)');
        }

        const cap = this.getSlotCapacity();
        const slotIndex = index / cap;
        const subIndex = <u32>(index % cap);

        const slotData = this.ensureSlot(slotIndex);
        const arr = this.unpackSlot(slotData);

        return unchecked(arr[subIndex]);
    }

    @inline
    @operator('[]=')
    public set(index: u32, value: T): void {
        if (index >= this.MAX_LENGTH) {
            throw new Revert('set: index exceeds MAX_LENGTH (packed array)');
        }

        const realIndex: u32 = this.getRealIndex(index);
        const cap = this.getSlotCapacity();
        const slotIndex = realIndex / cap;
        const subIndex = <u32>(realIndex % cap);

        let slotData = this.ensureSlot(slotIndex);
        const arr = this.unpackSlot(slotData);

        if (!this.eq(unchecked(arr[subIndex]), value)) {
            unchecked((arr[subIndex] = value));
            slotData = this.packSlot(arr);

            // Optimization: Update Cache and Map
            this.updateSlot(slotIndex, slotData);
        }
    }

    @inline
    public set_physical(index: u32, value: T): void {
        if (index >= this.MAX_LENGTH) {
            throw new Revert('set: index exceeds MAX_LENGTH (packed array)');
        }

        const cap = this.getSlotCapacity();
        const slotIndex = index / cap;
        const subIndex = <u32>(index % cap);

        let slotData = this.ensureSlot(slotIndex);
        const arr = this.unpackSlot(slotData);

        if (!this.eq(unchecked(arr[subIndex]), value)) {
            unchecked((arr[subIndex] = value));
            slotData = this.packSlot(arr);
            this.updateSlot(slotIndex, slotData);
        }
    }

    /**
     * Get the next item in the array, starting from the current offset.
     * This is useful for iterating through the array.
     */
    @inline
    public next(): T {
        const value = this.get(this.nextItemOffset);
        this.nextItemOffset += 1;

        return value;
    }

    @inline
    public incrementStartingIndex(): void {
        this._startIndex += 1;
        if (this._startIndex >= this.MAX_LENGTH) {
            this._startIndex = 0;
        }
        this._isChangedStartIndex = true;
    }

    /**
     * Apply the starting index with n offset.
     */
    @inline
    public applyNextOffsetToStartingIndex(): void {
        if (!this.nextItemOffset) return;

        // Optimization: Conditional subtraction instead of Modulo
        this._startIndex += this.nextItemOffset;
        this._startIndex %= this.MAX_LENGTH;

        this._isChangedStartIndex = true;
        this.nextItemOffset = 0;
    }

    @inline
    public push(value: T, isPhysical: bool = false): u32 {
        if (this._length >= this.MAX_LENGTH) {
            throw new Revert('push: array has reached MAX_LENGTH');
        }

        const realIndex: u32 = this.getRealIndex(this._length, isPhysical);
        const cap = this.getSlotCapacity();
        const slotIndex = realIndex / cap;
        const subIndex = <u32>(realIndex % cap);

        let slotData = this.ensureSlot(slotIndex);
        const arr = this.unpackSlot(slotData);

        if (!this.eq(unchecked(arr[subIndex]), value)) {
            unchecked((arr[subIndex] = value));
            slotData = this.packSlot(arr);
            this.updateSlot(slotIndex, slotData);
        }

        this._length += 1;
        this._isChangedLength = true;

        return realIndex;
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
        const currentData = unchecked(arr[subIndex]);

        if (!this.eq(currentData, this.defaultValue)) {
            unchecked((arr[subIndex] = this.defaultValue));
            slotData = this.packSlot(arr);
            this.updateSlot(slotIndex, slotData);
        }

        this._length -= 1;
        this._startIndex += 1;
        // Optimization: Fast Wrap
        if (this._startIndex >= this.MAX_LENGTH) {
            this._startIndex = 0;
        }

        this._isChangedLength = true;
        this._isChangedStartIndex = true;

        return currentData;
    }

    /**
     * "Delete" by zeroing out the element at `index`,
     * but does not reduce the length.
     */
    @inline
    public delete(index: u32): void {
        const realIndex = this.getRealIndex(index);
        const cap = this.getSlotCapacity();
        const slotIndex = realIndex / cap;
        const subIndex = <u32>(realIndex % cap);

        let slotData = this.ensureSlot(slotIndex);
        const arr = this.unpackSlot(slotData);

        const zeroVal = this.zeroValue();
        if (!this.eq(unchecked(arr[subIndex]), zeroVal)) {
            unchecked((arr[subIndex] = zeroVal));
            slotData = this.packSlot(arr);
            this.updateSlot(slotIndex, slotData);
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
     * "Delete" by zeroing out the element at `index`,
     * but does not reduce the length.
     */
    @inline
    public delete_physical(index: u32): void {
        if (index >= this.MAX_LENGTH) {
            throw new Revert('delete: index exceeds MAX_LENGTH (packed array)');
        }

        const cap = this.getSlotCapacity();
        const slotIndex = index / cap;
        const subIndex = <u32>(index % cap);

        let slotData = this.ensureSlot(slotIndex);
        const arr = this.unpackSlot(slotData);

        const zeroVal = this.zeroValue();
        if (!this.eq(unchecked(arr[subIndex]), zeroVal)) {
            unchecked((arr[subIndex] = zeroVal));
            slotData = this.packSlot(arr);
            this.updateSlot(slotIndex, slotData);
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
    public setMultiple(startIndex: u32, values: T[]): void {
        if (startIndex > u32.MAX_VALUE - <u32>values.length) {
            throw new Revert('setMultiple: end index overflow (packed array)');
        }

        const end = startIndex + <u32>values.length;
        if (end > this._length) {
            throw new Revert('setMultiple: out of range (packed array)');
        }

        // Sequential iteration benefits from Hot Slot Cache
        for (let i = 0; i < values.length; i++) {
            this.set(startIndex + <u32>i, unchecked(values[i]));
        }
    }

    @inline
    public getAll(startIndex: u32, count: u32): T[] {
        if (count > <u32>u32.MAX_VALUE) {
            throw new Revert('getAll: count too large (packed array)');
        }

        const out = new Array<T>(<i32>count);
        for (let i: u32 = 0; i < count; i++) {
            unchecked((out[<i32>i] = this.get(startIndex + i)));
        }

        return out;
    }

    @inline
    public getLength(): u32 {
        return this._length;
    }

    @inline
    public startingIndex(): u32 {
        return this._startIndex;
    }

    @inline
    public setStartingIndex(index: u32): void {
        if (index >= this.MAX_LENGTH) {
            throw new Revert('setStartingIndex: out of range');
        }

        this._startIndex = index;
        this._isChangedStartIndex = true;
    }

    /**
     * Return string "[v0, v1, ...]"
     */
    public toString(): string {
        let s = '[';
        for (let i: u32 = 0; i < this._length; i++) {
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
        const len = changed.length;

        for (let i = 0; i < len; i++) {
            const slotIndex = unchecked(changed[i]);
            const slotData = this._slots.get(slotIndex);
            if (slotData) {
                const ptr = this.calculateStoragePointer(<u64>slotIndex);
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
        const len = keys.length;

        for (let i = 0; i < len; i++) {
            const slotIndex = unchecked(keys[i]);
            const ptr = this.calculateStoragePointer(<u64>slotIndex);
            Blockchain.setStorageAt(ptr, GET_EMPTY_BUFFER());
        }

        // Reset length + startIndex
        Blockchain.setStorageAt(this.lengthPointer, GET_EMPTY_BUFFER());

        this._length = 0;
        this._startIndex = 0;
        this._isChangedLength = false;
        this._isChangedStartIndex = false;

        this._slots.clear();
        this._isChanged.clear();

        // Clear Cache
        this._cachedSlotIndex = <u32>-1;
        this._cachedSlotData = null;
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

        // Clear Cache
        this._cachedSlotIndex = <u32>-1;
        this._cachedSlotData = null;

        this.save();
    }

    /** Number of T items that fit in one 32-byte slot. */
    protected abstract getSlotCapacity(): u32;

    /** Return the "zero" value of type T. */
    protected abstract zeroValue(): T;

    /** Compare two T values for equality. */
    protected abstract eq(a: T, b: T): bool;

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

    /**
     * Ensure that slotIndex is loaded into _slots. If missing, read from storage.
     * * **Optimization:** Uses `_cachedSlotIndex` to return sequentially accessed data instantly.
     */
    @inline
    protected ensureSlot(slotIndex: u32): Uint8Array {
        // Fast Cache Check
        if (slotIndex == this._cachedSlotIndex) {
            return <Uint8Array>this._cachedSlotData;
        }

        // Map Lookup / Storage Load
        let data: Uint8Array;
        if (this._slots.has(slotIndex)) {
            data = this._slots.get(slotIndex);
        } else {
            const ptr = this.calculateStoragePointer(<u64>slotIndex);
            const storageData = Blockchain.getStorageAt(ptr);

            // Must be exactly 32 bytes; if it's empty, you get 32 zero bytes from GET_EMPTY_BUFFER()
            this._slots.set(slotIndex, storageData);
            data = storageData;
        }

        // Update Cache
        this._cachedSlotIndex = slotIndex;
        this._cachedSlotData = data;

        return data;
    }

    /**
     * Updates the slot data in the Map and Cache, and marks it as changed.
     */
    @inline
    protected updateSlot(slotIndex: u32, data: Uint8Array): void {
        this._slots.set(slotIndex, data);
        this._isChanged.add(slotIndex);

        // Keep cache in sync
        this._cachedSlotIndex = slotIndex;
        this._cachedSlotData = data;
    }

    @inline
    private getRealIndex(index: u32, isPhysical: bool = false): u32 {
        const maxLength = this.MAX_LENGTH;

        // FIX: Explicitly type 'start' as u32 to prevent implicit i32 casting of '0'
        const start: u32 = isPhysical ? 0 : this._startIndex;
        let realIndex: u32 = start + index;

        realIndex %= maxLength;

        return realIndex;
    }
}
