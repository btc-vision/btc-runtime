import { Blockchain } from '../env';
import { encodePointer } from '../math/abi';
import { bigEndianAdd } from '../math/bytes';
import { Revert } from '../types/Revert';

/**
 * @class BaseStoredString
 * @description
 * Base class for storing a string in a sequence of 32-byte storage slots, in UTF-8 format:
 *  - Slot 0: first 4 bytes = length (big-endian), next 28 bytes = partial data
 *  - Slot N>0: 32 bytes of data each
 *
 * The maximum is configurable via MAX_LENGTH parameter (default: 256).
 */
export abstract class BaseStoredString {
    protected readonly MAX_LENGTH: u32;
    protected readonly subPointer: Uint8Array;

    protected constructor(
        public pointer: u16,
        subPointer: Uint8Array,
        maxLength: u32 = 256,
    ) {
        this.subPointer = subPointer;
        this.MAX_LENGTH = maxLength;
    }

    protected _value: string = '';

    /**
     * Cached string value. If `_value` is empty, we call `load()` on first access.
     */
    public get value(): string {
        if (!this._value) {
            this.load();
        }
        return this._value;
    }

    public set value(v: string) {
        this._value = v;
        this.save();
    }

    /**
     * Derives a 32-byte pointer for the given chunkIndex and performs big-endian addition.
     * chunkIndex=0 => header slot, 1 => second slot, etc.
     */
    protected getPointer(chunkIndex: u64): Uint8Array {
        const className = this.getClassName();
        const base = encodePointer(this.pointer, this.subPointer, true, className);
        return bigEndianAdd(base, chunkIndex);
    }

    /**
     * Returns the class name for error messages - override in subclasses
     */
    protected abstract getClassName(): string;

    /**
     * Reads the first slot and returns the stored byte length (big-endian).
     * Returns 0 if the slot is all zero.
     */
    protected getStoredLength(): u32 {
        const headerSlot = Blockchain.getStorageAt(this.getPointer(0));
        const b0 = <u32>headerSlot[0];
        const b1 = <u32>headerSlot[1];
        const b2 = <u32>headerSlot[2];
        const b3 = <u32>headerSlot[3];
        return (b0 << 24) | (b1 << 16) | (b2 << 8) | b3;
    }

    /**
     * Clears old data from storage. Based on `oldLength`, determines how many slots
     * were used, and writes zeroed 32-byte arrays to each.
     */
    protected clearOldStorage(oldLength: u32): void {
        if (oldLength == 0) {
            return;
        }

        // We always use at least 1 slot (the header slot).
        let chunkCount: u64 = 1;

        // In the header slot, we can store up to 28 bytes of data.
        const remaining: u64 = oldLength > 28 ? oldLength - 28 : 0;
        if (remaining > 0) {
            // Each additional chunk is 32 bytes.
            // Use integer math ceiling: (remaining + 32 - 1) / 32
            chunkCount += (remaining + 32 - 1) / 32;
        }

        // Zero out each previously used slot
        for (let i: u64 = 0; i < chunkCount; i++) {
            Blockchain.setStorageAt(this.getPointer(i), new Uint8Array(32));
        }
    }

    /**
     * Saves the current string to storage in UTF-8 form.
     */
    protected save(): void {
        const oldLen = this.getStoredLength();
        this.clearOldStorage(oldLen);

        const utf8Data = String.UTF8.encode(this._value, false);
        const length = <u32>utf8Data.byteLength;

        // Enforce max length
        if (length > this.MAX_LENGTH) {
            throw new Revert(`${this.getClassName()}: value is too long (max=${this.MAX_LENGTH})`);
        }

        // If new string is empty, just store a zeroed header and return
        if (length == 0) {
            // A zeroed 32-byte array => indicates length=0
            Blockchain.setStorageAt(this.getPointer(0), new Uint8Array(32));
            return;
        }

        // Write the first slot: length + up to 28 bytes
        let remaining: u32 = length;
        let offset: u32 = 0;
        const firstSlot = new Uint8Array(32);
        firstSlot[0] = <u8>((length >> 24) & 0xff);
        firstSlot[1] = <u8>((length >> 16) & 0xff);
        firstSlot[2] = <u8>((length >> 8) & 0xff);
        firstSlot[3] = <u8>(length & 0xff);

        const bytes = Uint8Array.wrap(utf8Data);
        const firstChunkSize = remaining < 28 ? remaining : 28;
        for (let i: u32 = 0; i < firstChunkSize; i++) {
            firstSlot[4 + i] = bytes[i];
        }
        Blockchain.setStorageAt(this.getPointer(0), firstSlot);

        remaining -= firstChunkSize;
        offset += firstChunkSize;

        // Write subsequent slots (32 bytes each)
        let chunkIndex: u64 = 1;
        while (remaining > 0) {
            const slotData = new Uint8Array(32);
            const chunkSize = remaining < u32(32) ? remaining : u32(32);
            for (let i: u32 = 0; i < chunkSize; i++) {
                slotData[i] = bytes[offset + i];
            }
            Blockchain.setStorageAt(this.getPointer(chunkIndex), slotData);

            remaining -= chunkSize;
            offset += chunkSize;
            chunkIndex++;
        }
    }

    /**
     * Loads the string from storage by reading the stored byte length, then decoding
     * the corresponding UTF-8 data from the slots.
     */
    protected load(): void {
        // Read the header slot first
        const headerSlot = Blockchain.getStorageAt(this.getPointer(0));

        // Parse the big-endian length
        const b0 = <u32>headerSlot[0];
        const b1 = <u32>headerSlot[1];
        const b2 = <u32>headerSlot[2];
        const b3 = <u32>headerSlot[3];
        const length: u32 = (b0 << 24) | (b1 << 16) | (b2 << 8) | b3;

        // If length=0, then the string is empty
        if (length == 0) {
            this._value = '';
            return;
        }

        // Read the UTF-8 bytes from storage
        let remaining: u32 = length;
        let offset: u32 = 0;
        const out = new Uint8Array(length);

        // First slot can hold up to 28 bytes after the length
        const firstChunkSize = remaining < 28 ? remaining : 28;
        for (let i: u32 = 0; i < firstChunkSize; i++) {
            out[i] = headerSlot[4 + i];
        }
        remaining -= firstChunkSize;
        offset += firstChunkSize;

        // Read the subsequent slots of 32 bytes each
        let chunkIndex: u64 = 1;
        while (remaining > 0) {
            const slotData = Blockchain.getStorageAt(this.getPointer(chunkIndex));
            const chunkSize = remaining < 32 ? remaining : 32;
            for (let i: u32 = 0; i < chunkSize; i++) {
                out[offset + i] = slotData[i];
            }
            remaining -= chunkSize;
            offset += chunkSize;
            chunkIndex++;
        }

        // Decode UTF-8 into a normal string
        this._value = String.UTF8.decode(out.buffer, false);
    }
}
