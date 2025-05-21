import { BytesWriter } from '../../buffer/BytesWriter';
import { Blockchain } from '../../env';
import {
    addUint8ArraysBE,
    bigEndianAdd,
    encodeBasePointer,
    readLengthAndStartIndex,
    u64ToBE32Bytes,
} from '../../math/bytes';
import { Address } from '../../types/Address';
import { Revert } from '../../types/Revert';

/**
 * @class StoredAddressArray
 * @description Manages an array of Address values across multiple storage slots.
 * Each slot holds one Address (stored as a raw Uint8Array in storage).
 */
@final
export class StoredAddressArray {
    private readonly baseU256Pointer: Uint8Array;
    private readonly lengthPointer: Uint8Array;

    private _values: Map<u64, Address> = new Map(); // slotIndex -> Address
    private _isChanged: Set<u64> = new Set(); // track changed slotIndexes

    private _length: u64 = 0;
    private _startIndex: u64 = 0;
    private _isChangedLength: bool = false;
    private _isChangedStartIndex: bool = false;

    private readonly MAX_LENGTH: u64 = u64(u32.MAX_VALUE - 1);

    private readonly defaultValue: Address = Address.zero();

    /**
     * @constructor
     * @param {u16} pointer - The primary pointer identifier.
     * @param {Uint8Array} subPointer - The sub-pointer for memory slot addressing.
     */
    constructor(public pointer: u16, public subPointer: Uint8Array) {
        assert(
            subPointer.length <= 30,
            `You must pass a 30 bytes sub-pointer. (AddressArray, got ${subPointer.length})`,
        );

        const basePointer = encodeBasePointer(pointer, subPointer);
        this.lengthPointer = Uint8Array.wrap(basePointer.buffer);
        this.baseU256Pointer = bigEndianAdd(basePointer, 1);

        const storedLenStart = Blockchain.getStorageAt(basePointer);
        const data = readLengthAndStartIndex(storedLenStart);

        this._length = data[0];
        this._startIndex = data[1];
    }

    @inline
    public has(index: u64): bool {
        return index < this._length;
    }

    /** Get an element by its global index. */
    @inline
    @operator('[]')
    public get(index: u64): Address {
        if (index >= this._length) {
            throw new Revert('get: index out of range (address array)');
        }

        const physicalIndex = (this._startIndex + index) % this.MAX_LENGTH;
        const slotIndex: u32 = <u32>physicalIndex;
        this.ensureValues(slotIndex);

        return this._values.get(slotIndex);
    }

    /** Set an element by its global index. */
    @inline
    @operator('[]=')
    public set(index: u64, value: Address): void {
        if (index >= this._length) {
            throw new Revert('set: index out of range (address array)');
        }

        const physicalIndex = (this._startIndex + index) % this.MAX_LENGTH;
        const slotIndex: u32 = <u32>physicalIndex;
        this.ensureValues(slotIndex);

        const currentValue = this._values.get(slotIndex);
        if (currentValue != value) {
            this._values.set(slotIndex, value);
            this._isChanged.add(slotIndex);
        }
    }

    /** Append an address at the end of the array. */
    @inline
    public push(value: Address): void {
        if (this._length >= this.MAX_LENGTH) {
            throw new Revert('push: array reached maximum length (address array)');
        }

        const newLogicalIndex: u64 = this._length;
        const physicalIndex: u64 = (this._startIndex + newLogicalIndex) % this.MAX_LENGTH;
        const slotIndex: u32 = <u32>physicalIndex;

        this.ensureValues(slotIndex);
        this._values.set(slotIndex, value);
        this._isChanged.add(slotIndex);

        this._length += 1;
        this._isChangedLength = true;
    }

    /** Delete the last element. */
    public deleteLast(): void {
        if (this._length === 0) {
            throw new Revert('deleteLast: array is empty (address array)');
        }

        const lastLogicalIndex: u64 = this._length - 1;
        const physicalIndex: u64 = (this._startIndex + lastLogicalIndex) % this.MAX_LENGTH;
        const slotIndex: u32 = <u32>physicalIndex;
        this.ensureValues(slotIndex);

        const currentValue = this._values.get(slotIndex);
        if (currentValue != this.defaultValue) {
            this._values.set(slotIndex, this.defaultValue);
            this._isChanged.add(slotIndex);
        }

        this._length -= 1;
        this._isChangedLength = true;
    }

    /** Adjust the starting index. */
    public setStartingIndex(index: u64): void {
        this._startIndex = index;
        this._isChangedStartIndex = true;
    }

    /** Delete a specific element by setting it to `defaultValue`. */
    @inline
    public delete(index: u64): void {
        if (index > this.MAX_LENGTH) {
            throw new Revert('delete: index out of range (address array)');
        }

        const physicalIndex: u64 = (this._startIndex + index) % this.MAX_LENGTH;
        const slotIndex: u32 = <u32>physicalIndex;
        this.ensureValues(slotIndex);

        const currentValue = this._values.get(slotIndex);
        if (currentValue != this.defaultValue) {
            this._values.set(slotIndex, this.defaultValue);
            this._isChanged.add(slotIndex);
        }
    }

    /**
     * Persist changes to storage.
     *  - Store any changed slotIndex -> Address
     *  - Store updated length and startIndex if changed
     */
    @inline
    public save(): void {
        // 1) Save changed slots
        const changed = this._isChanged.values();
        for (let i = 0; i < changed.length; i++) {
            const slotIndex = changed[i];
            const storagePointer = this.calculateStoragePointer(slotIndex);

            const value = this._values.get(slotIndex);
            Blockchain.setStorageAt(storagePointer, value);
        }
        this._isChanged.clear();

        // 2) Save length and startIndex if changed
        if (this._isChangedLength || this._isChangedStartIndex) {
            const writer = new BytesWriter(16);
            writer.writeU64(this._length);
            writer.writeU64(this._startIndex);

            Blockchain.setStorageAt(this.lengthPointer, writer.getBuffer());
            this._isChangedLength = false;
            this._isChangedStartIndex = false;
        }
    }

    /** Clear entire array content from storage, reset length and startIndex. */
    public deleteAll(): void {
        const keys = this._values.keys();
        for (let i = 0; i < keys.length; i++) {
            const slotIndex = keys[i];
            const storagePointer = this.calculateStoragePointer(slotIndex);
            Blockchain.setStorageAt(storagePointer, this.defaultValue);
        }

        Blockchain.setStorageAt(this.lengthPointer, new Uint8Array(32));

        this._length = 0;
        this._startIndex = 0;
        this._isChangedLength = false;
        this._isChangedStartIndex = false;

        this._values.clear();
        this._isChanged.clear();
    }

    /** Bulk-set multiple addresses starting at `startIndex`. */
    @inline
    public setMultiple(startIndex: u32, values: Address[]): void {
        for (let i: u32 = 0; i < values.length; i++) {
            this.set(<u64>(startIndex + i), values[i]);
        }
    }

    /** Retrieve a batch of addresses (range). */
    @inline
    public getAll(startIndex: u32, count: u32): Address[] {
        if (startIndex + count > this._length) {
            throw new Revert('getAll: index out of range (address array)');
        }

        const result = new Array<Address>(count);
        for (let i: u32 = 0; i < count; i++) {
            result[i] = this.get(<u64>(startIndex + i));
        }
        return result;
    }

    /** Returns a string of the form "[addr0, addr1, ...]". */
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

    /** Reset in-memory and persist. */
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

    /** Current array length. */
    @inline
    public getLength(): u64 {
        return this._length;
    }

    /** Current starting index. */
    public startingIndex(): u64 {
        return this._startIndex;
    }

    /**
     * Ensure the given slot index is loaded into `_values`.
     */
    private ensureValues(slotIndex: u32): void {
        if (!this._values.has(slotIndex)) {
            const storagePointer = this.calculateStoragePointer(slotIndex);

            // Load raw bytes from storage
            const stored: Uint8Array = Blockchain.getStorageAt(storagePointer);

            const storedAddress: Address =
                stored.length == 0 ? this.defaultValue : Address.fromUint8Array(stored);

            this._values.set(slotIndex, storedAddress);
        }
    }

    /**
     * Compute a 32-byte storage pointer = basePointer + (slotIndex + 1) big-endian.
     */
    private calculateStoragePointer(slotIndex: u64): Uint8Array {
        // Convert (slotIndex) to a 32-byte big-endian offset
        const offset = u64ToBE32Bytes(slotIndex);

        return addUint8ArraysBE(this.baseU256Pointer, offset);
    }
}
