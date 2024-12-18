import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesWriter } from '../buffer/BytesWriter';
import { Blockchain } from '../env';
import { encodePointer } from '../math/abi';
import { SafeMath } from '../types/SafeMath';
import { U256_BYTE_LENGTH } from '../utils/lengths';

@final
export class StoredString {
    constructor(public pointer: u16, private defaultValue?: string) {}

    private _value: string = '';

    @inline
    public get value(): string {
        if (!this._value) {
            this.load();
        }

        return this._value;
    }

    @inline
    public set value(value: string) {
        this._value = value;
        this.save();
    }

    private min(a: u32, b: u32): u32 {
        return a < b ? a : b;
    }

    private getPointer(key: u256): u256 {
        const buf = new BytesWriter(U256_BYTE_LENGTH);
        buf.writeU256(key);

        return encodePointer(this.pointer, buf.getBuffer());
    }

    private save(): void {
        const length: u32 = this._value.length;
        if (length == 0) {
            return;
        }

        if (length > 2048) {
            throw new Error('StoredString: value is too long');
        }

        // Prepare the header with the length of the string in the first 4 bytes
        let header: u256 = u256.fromU32(length);
        header = SafeMath.shl(header, 224);

        let currentPointer: u256 = u256.Zero;
        let remainingLength: u32 = length;
        let offset: u32 = 0;

        // Save the initial chunk (first 28 bytes) in the header
        let bytesToWrite: u32 = this.min(remainingLength, 28);
        header = this.saveChunk(header, this._value, offset, bytesToWrite, 4);
        Blockchain.setStorageAt(this.getPointer(currentPointer), header);

        remainingLength -= bytesToWrite;
        offset += bytesToWrite;

        // Save the remaining chunks in subsequent storage slots
        while (remainingLength > 0) {
            bytesToWrite = this.min(remainingLength, 32);
            const storageValue: u256 = this.saveChunk(
                u256.Zero,
                this._value,
                offset,
                bytesToWrite,
                0,
            );
            currentPointer = u256.add(currentPointer, u256.One);
            Blockchain.setStorageAt(this.getPointer(currentPointer), storageValue);

            remainingLength -= bytesToWrite;
            offset += bytesToWrite;
        }
    }

    // Helper method to save a chunk of the string into the storage slot
    private saveChunk(
        storage: u256,
        value: string,
        offset: u32,
        length: u32,
        storageOffset: u32,
    ): u256 {
        const bytes = storage.toBytes(true);
        for (let i: u32 = 0; i < length; i++) {
            const index: i32 = i32(offset + i);
            bytes[i + storageOffset] = u8(value.charCodeAt(index));
        }
        return u256.fromBytes(bytes, true);
    }

    private load(): void {
        const header: u256 = Blockchain.getStorageAt(this.getPointer(u256.Zero), u256.Zero);
        if (u256.eq(header, u256.Zero)) {
            if (this.defaultValue) {
                this.value = this.defaultValue;
            }

            return;
        }

        // the length of the string is stored in the first 4 bytes of the header
        const bits: u256 = u256.shr(header, 224);
        const length: u32 = bits.toU32();

        // the rest contains the string itself
        let currentPointer: u256 = u256.Zero;
        let remainingLength: u32 = length;
        let currentStorage: u256 = header;

        const bytesToRead: u32 = this.min(remainingLength, 28);
        let str: string = this.loadChunk(currentStorage, 4, bytesToRead);
        remainingLength -= bytesToRead;

        while (remainingLength > 0) {
            // Move to the next storage slot
            currentPointer = u256.add(currentPointer, u256.One);
            currentStorage = Blockchain.getStorageAt(this.getPointer(currentPointer), u256.Zero);

            // Extract the relevant portion of the string from the current storage slot
            const bytesToRead: u32 = this.min(remainingLength, 32);
            str += this.loadChunk(currentStorage, 0, bytesToRead);

            remainingLength -= bytesToRead;
        }

        this._value = str;
    }

    private loadChunk(value: u256, offset: u32, length: u32): string {
        const bytes = value.toBytes(true);

        let str: string = '';
        for (let i: u32 = 0; i < length; i++) {
            str += String.fromCharCode(bytes[i + offset]);
        }

        return str;
    }
}
