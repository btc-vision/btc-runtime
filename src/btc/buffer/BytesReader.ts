import { Address, ADDRESS_BYTE_LENGTH } from '../types/Address';
import { Selector } from '../math/abi';
import { u256 } from 'as-bignum/assembly';
import { Revert } from '../types/Revert';
import { Map } from '../generic/Map';

@final
export class BytesReader {
    private readonly buffer: DataView;

    private currentOffset: i32 = 0;

    constructor(bytes: Uint8Array) {
        this.buffer = new DataView(bytes.buffer);
    }

    public readU8(): u8 {
        this.verifyEnd(this.currentOffset + 1);

        return this.buffer.getUint8(this.currentOffset++);
    }

    public readU16(): u16 {
        this.verifyEnd(this.currentOffset + 2);

        const value = this.buffer.getUint16(this.currentOffset, true);
        this.currentOffset += 2;

        return value;
    }

    public readU32(le: boolean = true): u32 {
        this.verifyEnd(this.currentOffset + 4);

        const value = this.buffer.getUint32(this.currentOffset, le);
        this.currentOffset += 4;
        return value;
    }

    public readU64(): u64 {
        this.verifyEnd(this.currentOffset + 8);

        const value = this.buffer.getUint64(this.currentOffset, true);
        this.currentOffset += 8;

        return value;
    }

    public readU256(): u256 {
        const next32Bytes: u8[] = [];
        for (let i = 0; i < 32; i++) {
            next32Bytes[i] = this.readU8();
        }

        return u256.fromBytesBE(next32Bytes);
    }

    public readBytes(length: u32, zeroStop: boolean = false): Uint8Array {
        this.verifyEnd(this.currentOffset + length);

        let bytes: Uint8Array = new Uint8Array(length);
        for (let i: u32 = 0; i < length; i++) {
            const byte: u8 = this.readU8();
            if (zeroStop && byte === 0) {
                bytes = bytes.slice(0, i);

                this.currentOffset += length - (i + 1);
                break;
            }

            bytes[i] = byte;
        }

        return bytes;
    }

    public readMultiBytesAddressMap(): Map<Address, Uint8Array[]> {
        const map: Map<Address, Uint8Array[]> = new Map<Address, Uint8Array[]>();
        const size: u8 = this.readU8();

        if (size > 8) throw new Revert('Too many contract called.');

        for (let i: u8 = 0; i < size; i++) {
            const address: Address = this.readAddress();
            const responseSize: u8 = this.readU8();

            if (responseSize > 10) throw new Revert('Too many calls.');

            const calls: Uint8Array[] = [];
            for (let j: u8 = 0; j < responseSize; j++) {
                const response: Uint8Array = this.readBytesWithLength();
                calls.push(response);
            }

            map.set(address, calls);
        }

        return map;
    }

    public readBytesWithLength(): Uint8Array {
        const length = this.readU32();

        return this.readBytes(length);
    }

    public readString(length: u16): string {
        const bytes = this.readBytes(length, true);

        return String.UTF8.decode(bytes.buffer);
    }

    public readTuple(): u256[] {
        const length = this.readU32();
        const result: u256[] = new Array<u256>(length);

        for (let i = 0; i < length; i++) {
            result[i] = this.readU256();
        }

        return result;
    }

    public readAddressValueTuple(): Map<Address, u256> {
        const length: u16 = this.readU16();
        const result = new Map<Address, u256>();

        for (let i: u16 = 0; i < length; i++) {
            const address = this.readAddress();
            const value = this.readU256();

            if (result.has(address)) throw new Revert('Duplicate address found in map');

            result.set(address, value);
        }

        return result;
    }

    public readSelector(): Selector {
        return this.readU32(false);
    }

    public readStringWithLength(): string {
        const length = this.readU16();

        return this.readString(length);
    }

    public readBoolean(): boolean {
        return this.readU8() !== 0;
    }

    public readFloat(): f32 {
        const value = this.buffer.getFloat32(this.currentOffset, true);
        this.currentOffset += 4;

        return value;
    }

    public readAddress(): Address {
        return this.readString(ADDRESS_BYTE_LENGTH);
    }

    public getOffset(): i32 {
        return this.currentOffset;
    }

    public setOffset(offset: i32): void {
        this.currentOffset = offset;
    }

    public verifyEnd(size: i32): void {
        if (this.currentOffset > this.buffer.byteLength) {
            throw new Error(`Expected to read ${size} bytes but read ${this.currentOffset} bytes`);
        }
    }

    private verifyChecksum(): void {
        const writtenChecksum = this.readU32();

        let checksum: u32 = 0;
        for (let i = 0; i < this.buffer.byteLength; i++) {
            checksum += this.buffer.getUint8(i);
        }

        checksum = checksum % (2 ** 32);

        if (checksum !== writtenChecksum) {
            throw new Error('Invalid checksum for buffer');
        }
    }
}
