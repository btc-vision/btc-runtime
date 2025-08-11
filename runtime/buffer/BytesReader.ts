import {i128, u128, u256} from '@btc-vision/as-bignum/assembly';
import {AddressMap} from '../generic/AddressMap';
import {Selector} from '../math/abi';
import {Address} from '../types/Address';
import {Revert} from '../types/Revert';
import {
    ADDRESS_BYTE_LENGTH,
    I128_BYTE_LENGTH,
    I64_BYTE_LENGTH,
    U128_BYTE_LENGTH,
    U16_BYTE_LENGTH,
    U256_BYTE_LENGTH,
    U32_BYTE_LENGTH,
    U64_BYTE_LENGTH,
    U8_BYTE_LENGTH,
} from '../utils';

@final
export class BytesReader {
    private readonly buffer: DataView;
    private currentOffset: i32 = 0;

    constructor(bytes: Uint8Array) {
        this.buffer = new DataView(bytes.buffer);
    }

    public get byteLength(): i32 {
        return this.buffer.byteLength;
    }

    public read<T>(): T {
        const id = idof<T>();

        if (isBoolean<T>()) {
            return this.readBoolean() as T;
        } else if (isString<T>()) {
            return this.readStringWithLength() as T;
        } else if (isInteger<T>()) {
            if (isSigned<T>()) {
                const size = sizeof<T>();

                switch (size) {
                    case 8:
                        return this.readI8() as T;
                    case 16:
                        return this.readI16() as T;
                    case 32:
                        return this.readI32() as T;
                    case 64:
                        return this.readI64() as T;
                    default:
                        throw new Error(`Invalid size ${size}`);
                }
            } else {
                const size = sizeof<T>();

                switch (size) {
                    case 8:
                        return this.readU8() as T;
                    case 16:
                        return this.readU16() as T;
                    case 32:
                        return this.readU32() as T;
                    case 64:
                        return this.readU64() as T;
                    default:
                        throw new Error(`Invalid size ${size}`);
                }
            }
        } else if (id === idof<u256>()) {
            return this.readU256() as T;
        } else if (id === idof<u128>()) {
            return this.readU128() as T;
        } else if (id === idof<i128>()) {
            return this.readI128() as T;
        } else if (id === idof<Address>()) {
            return this.readAddress() as T;
        } else if (id === idof<Uint8Array>()) {
            return this.readBytesWithLength() as T;
        } else if (id === idof<string>()) {
            return this.readStringWithLength() as T;
        } else {
            throw new Error(`Unsupported type ${id}`);
        }
    }

    public readI16(): i16 {
        this.verifyEnd(this.currentOffset + 2);
        const value = this.buffer.getInt16(this.currentOffset, true);
        this.currentOffset += 2;
        return value;
    }

    public readI32(): i32 {
        this.verifyEnd(this.currentOffset + 4);
        const value = this.buffer.getInt32(this.currentOffset, true);
        this.currentOffset += 4;
        return value;
    }

    public readI8(): i8 {
        this.verifyEnd(this.currentOffset + U8_BYTE_LENGTH);
        const value = this.buffer.getInt8(this.currentOffset);
        this.currentOffset += U8_BYTE_LENGTH;
        return value;
    }

    public readU8(): u8 {
        this.verifyEnd(this.currentOffset + U8_BYTE_LENGTH);
        const value = this.buffer.getUint8(this.currentOffset);
        this.currentOffset += U8_BYTE_LENGTH;
        return value;
    }

    /**
     * By default, big-endian (be = true).
     */
    public readU16(be: boolean = true): u16 {
        this.verifyEnd(this.currentOffset + U16_BYTE_LENGTH);
        const value = this.buffer.getUint16(this.currentOffset, !be);
        this.currentOffset += U16_BYTE_LENGTH;
        return value;
    }

    /**
     * By default, big-endian (be = true).
     */
    public readU32(be: boolean = true): u32 {
        this.verifyEnd(this.currentOffset + U32_BYTE_LENGTH);
        const value = this.buffer.getUint32(this.currentOffset, !be);
        this.currentOffset += U32_BYTE_LENGTH;
        return value;
    }

    /**
     * By default, big-endian (be = true).
     */
    public readU64(be: boolean = true): u64 {
        this.verifyEnd(this.currentOffset + U64_BYTE_LENGTH);
        const value = this.buffer.getUint64(this.currentOffset, !be);
        this.currentOffset += U64_BYTE_LENGTH;
        return value;
    }

    /**
     * Reads 256 bits. The writer calls `writeU256(value, be)`.
     * If be=true, we do big-endian; if be=false, little-endian.
     */
    public readU256(be: boolean = true): u256 {
        this.verifyEnd(this.currentOffset + U256_BYTE_LENGTH);
        const raw: u8[] = this.readBytesArray(U256_BYTE_LENGTH);
        return be ? u256.fromBytesBE(raw) : u256.fromBytesLE(raw);
    }

    public readI64(be: boolean = true): i64 {
        this.verifyEnd(this.currentOffset + I64_BYTE_LENGTH);
        const value = this.buffer.getInt64(this.currentOffset, !be);
        this.currentOffset += I64_BYTE_LENGTH;
        return value;
    }

    public readU128(be: boolean = true): u128 {
        this.verifyEnd(this.currentOffset + U128_BYTE_LENGTH);
        const raw: u8[] = this.readBytesArray(U128_BYTE_LENGTH);
        return be ? u128.fromBytesBE(raw) : u128.fromBytesLE(raw);
    }

    public readI128(be: boolean = true): i128 {
        this.verifyEnd(this.currentOffset + I128_BYTE_LENGTH);
        const raw: u8[] = this.readBytesArray(I128_BYTE_LENGTH);
        return be ? i128.fromBytesBE(raw) : i128.fromBytesLE(raw);
    }

    /**
     * Reads `length` bytes, optionally stopping early if a 0x00 is seen.
     */
    public readBytes(length: u32, zeroStop: boolean = false): Uint8Array {
        let bytes = new Uint8Array(length);
        for (let i: u32 = 0; i < length; i++) {
            const b: u8 = this.readU8();
            if (zeroStop && b === 0) {
                bytes = bytes.subarray(0, i);
                break;
            }
            bytes[i] = b;
        }
        return bytes;
    }

    /**
     * Convenience for reading a fixed number of bytes into a plain u8[] array.
     */
    @inline
    public readBytesArray(count: i32): u8[] {
        const arr = new Array<u8>(count);
        for (let i = 0; i < count; i++) {
            arr[i] = this.readU8();
        }
        return arr;
    }

    /**
     * [u32 length][raw bytes]. By default big-endian for the length,
     * to match AS BytesWriter's `writeBytesWithLength`.
     */
    public readBytesWithLength(be: boolean = true): Uint8Array {
        const length = this.readU32(be);
        return this.readBytes(length);
    }

    /**
     * Reads a string of `length` raw bytes, zeroStop = true for convenience.
     * (Or the writer may not have used zeroStop.)
     */
    public readString(length: u32): string {
        const bytes = this.readBytes(length, true);
        return String.UTF8.decode(bytes.buffer);
    }

    public readStringWithLength(be: boolean = true): string {
        const length = this.readU32(be);
        return this.readString(length);
    }

    public readBoolean(): boolean {
        return this.readU8() !== 0;
    }

    public readSelector(): Selector {
        return this.readU32(true);
    }

    /**
     * Reads an Address (32 bytes).
     */
    public readAddress(): Address {
        this.verifyEnd(this.currentOffset + ADDRESS_BYTE_LENGTH);

        const addr = new Address();
        for (let i: i32 = 0; i < ADDRESS_BYTE_LENGTH; i++) {
            addr[i] = this.readU8();
        }
        return addr;
    }

    // ------------------- Arrays ------------------- //

    public readU256Array(be: boolean = true): u256[] {
        const length = this.readU16();
        const result = new Array<u256>(length);
        for (let i: u32 = 0; i < length; i++) {
            result[i] = this.readU256(be);
        }
        return result;
    }

    public readU64Array(be: boolean = true): u64[] {
        const length = this.readU16(be);
        const result = new Array<u64>(length);
        for (let i: u32 = 0; i < length; i++) {
            result[i] = this.readU64(be);
        }
        return result;
    }

    public readU32Array(be: boolean = true): u32[] {
        const length = this.readU16(be);
        const result = new Array<u32>(length);
        for (let i: u16 = 0; i < length; i++) {
            result[i] = this.readU32(be);
        }
        return result;
    }

    public readU16Array(be: boolean = true): u16[] {
        const length = this.readU16(be);
        const result = new Array<u16>(length);
        for (let i: u16 = 0; i < length; i++) {
            result[i] = this.readU16(be);
        }
        return result;
    }

    public readU128Array(be: boolean = true): u128[] {
        const length = this.readU16(be);
        const result = new Array<u128>(length);
        for (let i: u16 = 0; i < length; i++) {
            result[i] = this.readU128(be);
        }
        return result;
    }

    public readAddressArray(be: boolean = true): Address[] {
        const length = this.readU16(be);
        const result = new Array<Address>(length);
        for (let i: u16 = 0; i < length; i++) {
            result[i] = this.readAddress();
        }
        return result;
    }

    public readAddressMapU256(be: boolean = true): AddressMap<u256> {
        const length = this.readU16(be);
        const result = new AddressMap<u256>();

        for (let i: u16 = 0; i < length; i++) {
            const address = this.readAddress();
            const value = this.readU256(be);

            if (result.has(address)) {
                throw new Revert('Duplicate address found in map');
            }
            result.set(address, value);
        }

        return result;
    }

    public getOffset(): i32 {
        return this.currentOffset;
    }

    public setOffset(offset: i32): void {
        this.currentOffset = offset;
    }

    /**
     * Checks if we have enough bytes left in the buffer.
     */
    public verifyEnd(size: i32): void {
        if (size > this.buffer.byteLength) {
            throw new Error(
                `Attempt to read beyond buffer length. Requested up to offset ${size}, ` +
                `but buffer is only ${this.buffer.byteLength} bytes.`,
            );
        }
    }

    public toString(): string {
        return Uint8Array.wrap(this.buffer.buffer).toString();
    }
}
