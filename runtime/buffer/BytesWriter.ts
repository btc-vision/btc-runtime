import { i128, u128, u256 } from '@btc-vision/as-bignum/assembly';
import { AddressMap } from '../generic/AddressMap';
import { Selector } from '../math/abi';
import { Address } from '../types/Address';
import { Revert } from '../types/Revert';
import {
    ADDRESS_BYTE_LENGTH,
    I128_BYTE_LENGTH,
    U128_BYTE_LENGTH,
    U16_BYTE_LENGTH,
    U256_BYTE_LENGTH,
    U32_BYTE_LENGTH,
    U64_BYTE_LENGTH,
    U8_BYTE_LENGTH,
} from '../utils';
import { BytesReader } from './BytesReader';

@final
export class BytesWriter {
    private currentOffset: u32 = 0;
    private buffer: DataView;
    private readonly typedArray: Uint8Array;

    constructor(length: i32) {
        const typedArray = (this.typedArray = new Uint8Array(length));
        this.buffer = new DataView(typedArray.buffer);
    }

    public bufferLength(): u32 {
        return this.buffer.byteLength;
    }

    public write<T>(value: T): void {
        if (isInteger<T>()) {
            const size = sizeof<T>();
            if (size === 1) {
                this.writeU8(<u8>value);
                return;
            }

            if (isSigned<T>()) {
                switch (size) {
                    case 2:
                        this.writeI16(<i16>value);
                        break;
                    case 4:
                        this.writeI32(<i32>value);
                        break;
                    case 8:
                        this.writeI64(<i64>value);
                        break;
                    default:
                        throw new Revert(`Unsupported integer size: ${size}`);
                }
            } else {
                switch (size) {
                    case 2:
                        this.writeU16(<u16>value);
                        break;
                    case 4:
                        this.writeU32(<u32>value);
                        break;
                    case 8:
                        this.writeU64(<u64>value);
                        break;
                    default:
                        throw new Revert(`Unsupported integer size: ${size}`);
                }
            }
        } else if (isBoolean<T>()) {
            this.writeBoolean(<boolean>value);
        } else if (isString<T>()) {
            this.writeStringWithLength(<string>value);
        } else if (value instanceof Uint8Array) {
            this.writeBytesWithLength(<Uint8Array>value);
        } else if (value instanceof Address) {
            this.writeAddress(<Address>value);
        } else if (value instanceof u128) {
            this.writeU128(<u128>value);
        } else if (value instanceof u256) {
            this.writeU256(<u256>value);
        } else if (value instanceof i128) {
            this.writeI128(<i128>value);
        } else {
            throw new Revert(`Unsupported type: ${typeof value}`);
        }
    }

    public writeU8(value: u8): void {
        this.allocSafe(U8_BYTE_LENGTH);
        this.buffer.setUint8(this.currentOffset, value);
        this.currentOffset += U8_BYTE_LENGTH;
    }

    /**
     * Writes a 16-bit unsigned integer. By default big-endian (be = true).
     * If be=false, writes little-endian.
     */
    public writeU16(value: u16, be: boolean = true): void {
        this.allocSafe(U16_BYTE_LENGTH);
        this.buffer.setUint16(this.currentOffset, value, !be);
        this.currentOffset += U16_BYTE_LENGTH;
    }

    /**
     * Writes a 32-bit unsigned integer. By default big-endian (be = true).
     */
    public writeU32(value: u32, be: boolean = true): void {
        this.allocSafe(U32_BYTE_LENGTH);
        this.buffer.setUint32(this.currentOffset, value, !be);
        this.currentOffset += U32_BYTE_LENGTH;
    }

    /**
     * Writes a 64-bit unsigned integer. By default big-endian (be = true).
     */
    public writeU64(value: u64, be: boolean = true): void {
        this.allocSafe(U64_BYTE_LENGTH);
        this.buffer.setUint64(this.currentOffset, value || 0, !be);
        this.currentOffset += U64_BYTE_LENGTH;
    }

    public writeI64(value: i64, be: boolean = true): void {
        this.allocSafe(U64_BYTE_LENGTH);
        this.buffer.setInt64(this.currentOffset, value, !be);
        this.currentOffset += U64_BYTE_LENGTH;
    }

    public writeI32(value: i32, be: boolean = true): void {
        this.allocSafe(U32_BYTE_LENGTH);
        this.buffer.setInt32(this.currentOffset, value, !be);
        this.currentOffset += U32_BYTE_LENGTH;
    }

    public writeI16(value: i16, be: boolean = true): void {
        this.allocSafe(U16_BYTE_LENGTH);
        this.buffer.setInt16(this.currentOffset, value, !be);
        this.currentOffset += U16_BYTE_LENGTH;
    }

    /**
     * Writes a 32-bit selector.
     * @param value
     */
    public writeSelector(value: Selector): void {
        this.writeU32(value, true);
    }

    public writeBoolean(value: boolean): void {
        this.writeU8(value ? 1 : 0);
    }

    /**
     * Writes a 256-bit unsigned integer. By default big-endian (be = true).
     */
    public writeU256(value: u256, be: boolean = true): void {
        this.allocSafe(U256_BYTE_LENGTH);
        const bytes = value.toUint8Array(be);
        for (let i: i32 = 0; i < U256_BYTE_LENGTH; i++) {
            this.writeU8(bytes[i]);
        }
    }

    /**
     * Writes a 128-bit signed integer. By default big-endian (be = true).
     */
    public writeI128(value: i128, be: boolean = true): void {
        this.allocSafe(I128_BYTE_LENGTH);
        const bytes = value.toUint8Array(be);
        for (let i: i32 = 0; i < I128_BYTE_LENGTH; i++) {
            this.writeU8(bytes[i]);
        }
    }

    /**
     * Writes a 128-bit unsigned integer. By default big-endian (be = true).
     */
    public writeU128(value: u128, be: boolean = true): void {
        this.allocSafe(U128_BYTE_LENGTH);
        const bytes = value.toUint8Array(be);
        for (let i: i32 = 0; i < U128_BYTE_LENGTH; i++) {
            this.writeU8(bytes[i]);
        }
    }

    // ------------------ Array Writers ------------------ //

    public writeU16Array(value: u16[], be: boolean = true): void {
        if (value.length > 65535) throw new Revert('Array size is too large');
        this.allocSafe(U16_BYTE_LENGTH + value.length * U16_BYTE_LENGTH);
        this.writeU16(u16(value.length), be);

        for (let i = 0; i < value.length; i++) {
            this.writeU16(value[i], be);
        }
    }

    public writeU32Array(value: u32[], be: boolean = true): void {
        if (value.length > 65535) throw new Revert('Array size is too large');
        this.allocSafe(U16_BYTE_LENGTH + value.length * U32_BYTE_LENGTH);
        this.writeU16(u16(value.length), be);

        for (let i = 0; i < value.length; i++) {
            this.writeU32(value[i], be);
        }
    }

    public writeU64Array(value: u64[], be: boolean = true): void {
        if (value.length > 65535) throw new Revert('Array size is too large');
        this.allocSafe(U16_BYTE_LENGTH + value.length * U64_BYTE_LENGTH);
        this.writeU16(u16(value.length), be);

        for (let i = 0; i < value.length; i++) {
            this.writeU64(value[i], be);
        }
    }

    public writeU128Array(value: u128[], be: boolean = true): void {
        if (value.length > 65535) throw new Revert('Array size is too large');
        this.allocSafe(U16_BYTE_LENGTH + value.length * U128_BYTE_LENGTH);
        this.writeU16(u16(value.length), be);

        for (let i = 0; i < value.length; i++) {
            this.writeU128(value[i], be);
        }
    }

    public writeU256Array(value: u256[], be: boolean = true): void {
        if (value.length > 65535) throw new Revert('Array size is too large');
        this.allocSafe(U16_BYTE_LENGTH + value.length * U256_BYTE_LENGTH);
        this.writeU16(u16(value.length), be);

        for (let i = 0; i < value.length; i++) {
            this.writeU256(value[i], be);
        }
    }

    public writeAddressArray(value: Address[]): void {
        if (value.length > 65535) throw new Revert('Array size is too large');
        this.writeU16(u16(value.length));

        for (let i: i32 = 0; i < value.length; i++) {
            this.writeAddress(value[i]);
        }
    }

    // --------------------------------------------------- //

    public writeBytes(value: Uint8Array): void {
        this.allocSafe(value.length);
        for (let i = 0; i < value.length; i++) {
            this.writeU8(value[i]);
        }
    }

    public writeBytesU8Array(value: u8[]): void {
        this.allocSafe(value.length);
        for (let i = 0; i < value.length; i++) {
            this.writeU8(value[i]);
        }
    }

    /**
     * Writes [u32 length][raw bytes].
     * By default big-endian, so length is stored with `writeU32(length, true)`.
     */
    public writeBytesWithLength(value: Uint8Array): void {
        const length: u32 = u32(value.length);
        this.allocSafe(length + U32_BYTE_LENGTH);
        this.writeU32(length); // default be = true => big-endian
        for (let i: u32 = 0; i < length; i++) {
            this.writeU8(value[i]);
        }
    }

    public writeString(value: string): void {
        const bytes = String.UTF8.encode(value);
        this.writeBytes(Uint8Array.wrap(bytes));
    }

    public writeStringWithLength(value: string): void {
        const bytes = String.UTF8.encode(value);
        this.writeU32(bytes.byteLength);
        this.writeBytes(Uint8Array.wrap(bytes));
    }

    public writeAddress(value: Address): void {
        const bytes = this.fromAddress(value);
        this.writeBytes(bytes);
    }

    // zero-copy bulk writer
    public writeRaw(data: Uint8Array): void {
        const n = data.length;
        this.allocSafe(n);

        const off = this.currentOffset;
        const dst = this.typedArray;

        memory.copy(changetype<usize>(dst.buffer) + <usize>off, changetype<usize>(data.buffer), n);

        this.currentOffset = off + n;
    }

    public writeRawSlice(data: Uint8Array, offset: i32, length: i32): void {
        if (offset < 0 || length < 0 || offset + length > data.length) {
            throw new Revert('writeRawSlice bounds');
        }

        this.allocSafe(length);

        const off = this.currentOffset;
        const dst = this.typedArray;

        memory.copy(
            changetype<usize>(dst.buffer) + <usize>off,
            changetype<usize>(data.buffer) + <usize>offset,
            length,
        );

        this.currentOffset = off + length;
    }

    /**
     * Equivalent to TS’s writeAddressValueTuple, except specialized for u256 values.
     */
    public writeAddressMapU256(value: AddressMap<u256>, be: boolean = true): void {
        const keys: Address[] = value.keys();
        if (keys.length > 65535) throw new Revert('Map size is too large');

        this.writeU16(u16(keys.length), be);

        for (let i: i32 = 0; i < keys.length; i++) {
            this.writeAddress(keys[i]);
            this.writeU256(value.get(keys[i]), be);
        }
    }

    // --------------------------------------------------- //

    public getBuffer(): Uint8Array {
        return this.typedArray;
    }

    public toBytesReader(): BytesReader {
        return new BytesReader(this.getBuffer());
    }

    public getOffset(): u32 {
        return this.currentOffset;
    }

    public setOffset(offset: u32): void {
        this.currentOffset = offset;
    }

    /**
     * Ensures we have space for `size` more bytes without going past the current buffer.
     * If not, calls `resize()` which by default throws a Revert.
     */
    public allocSafe(size: u32): void {
        const needed = this.currentOffset + size;
        if (needed > u32(this.buffer.byteLength)) {
            const sizeDiff: u32 = needed - u32(this.buffer.byteLength);
            this.resize(sizeDiff);
        }
    }

    private fromAddress(pubKey: Address): Uint8Array {
        if (pubKey.byteLength > ADDRESS_BYTE_LENGTH) {
            throw new Revert(
                `Address is too long ${pubKey.byteLength} > ${ADDRESS_BYTE_LENGTH} bytes`,
            );
        }
        return pubKey;
    }

    /**
     * This implementation always throws rather than actually resizing,
     * which is consistent with the original approach. If you need
     * dynamic resizing, remove the `throw` and implement accordingly.
     */
    private resize(size: u32): void {
        throw new Revert(
            `Buffer is getting resized. This is bad for performance. ` +
                `Expected size: ${this.buffer.byteLength + size} - ` +
                `Current size: ${this.buffer.byteLength}`,
        );
    }
}
