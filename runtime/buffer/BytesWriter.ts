import { i128, u128, u256 } from '@btc-vision/as-bignum/assembly';
import { ArrayBuffer } from 'arraybuffer';
import { AddressMap } from '../generic/AddressMap';
import { Selector } from '../math/abi';
import { i256 } from '../math/i256';
import { Address } from '../types/Address';
import { Revert } from '../types/Revert';
import {
    ADDRESS_BYTE_LENGTH,
    I128_BYTE_LENGTH,
    I256_BYTE_LENGTH,
    U128_BYTE_LENGTH,
    U16_BYTE_LENGTH,
    U256_BYTE_LENGTH,
    U32_BYTE_LENGTH,
    U64_BYTE_LENGTH,
    U8_BYTE_LENGTH,
} from '../utils/lengths';
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

    public writeU8(value: u8): void {
        this.allocSafe(U8_BYTE_LENGTH);
        this.buffer.setUint8(this.currentOffset, value);
        this.currentOffset += U8_BYTE_LENGTH;
    }

    public writeU16(value: u16): void {
        this.allocSafe(U16_BYTE_LENGTH);
        this.buffer.setUint16(this.currentOffset, value, true);
        this.currentOffset += U16_BYTE_LENGTH;
    }

    public writeU32(value: u32, le: boolean = true): void {
        this.allocSafe(U32_BYTE_LENGTH);
        this.buffer.setUint32(this.currentOffset, value, le);
        this.currentOffset += U32_BYTE_LENGTH;
    }

    public writeU64(value: u64): void {
        this.allocSafe(U64_BYTE_LENGTH);
        this.buffer.setUint64(this.currentOffset, value || 0, true);
        this.currentOffset += U64_BYTE_LENGTH;
    }

    public writeAddressArray(value: Address[]): void {
        if (value.length > 65535) throw new Revert('Array size is too large');

        this.writeU16(u16(value.length));

        for (let i: i32 = 0; i < value.length; i++) {
            this.writeAddress(value[i]);
        }
    }

    public writeSelector(value: Selector): void {
        this.writeU32(value, false);
    }

    public writeBoolean(value: boolean): void {
        this.writeU8(value ? 1 : 0);
    }

    public writeI256(value: i256): void {
        this.allocSafe(I256_BYTE_LENGTH);

        const bytes = value.toUint8Array(true);
        for (let i: i32 = 0; i < I256_BYTE_LENGTH; i++) {
            this.writeU8(bytes[i] || 0);
        }
    }

    public writeU8At(value: u8, offset: u32): void {
        this.buffer.setUint8(offset, value);
    }

    public writeU256(value: u256): void {
        this.allocSafe(U256_BYTE_LENGTH);

        const bytes = value.toUint8Array(true);
        for (let i: i32 = 0; i < U256_BYTE_LENGTH; i++) {
            this.writeU8(bytes[i] || 0);
        }
    }

    public writeI128(value: i128): void {
        this.allocSafe(I128_BYTE_LENGTH);

        const bytes = value.toUint8Array(true);
        for (let i: i32 = 0; i < I128_BYTE_LENGTH; i++) {
            this.writeU8(bytes[i] || 0);
        }
    }

    public writeU128(value: u128): void {
        this.allocSafe(U128_BYTE_LENGTH);

        const bytes = value.toUint8Array(true);
        for (let i: i32 = 0; i < U128_BYTE_LENGTH; i++) {
            this.writeU8(bytes[i] || 0);
        }
    }

    public writeTuple(value: u256[]): void {
        this.allocSafe(U32_BYTE_LENGTH + value.length * U256_BYTE_LENGTH);
        this.writeU32(u32(value.length));

        for (let i = 0; i < value.length; i++) {
            this.writeU256(value[i]);
        }
    }

    public writeU128Array(value: u128[]): void {
        if (value.length > 65535) throw new Revert('Array size is too large');

        this.allocSafe(U16_BYTE_LENGTH + value.length * U128_BYTE_LENGTH);
        this.writeU16(u16(value.length));

        for (let i = 0; i < value.length; i++) {
            this.writeU128(value[i]);
        }
    }

    public writeBytes(value: Uint8Array): void {
        this.allocSafe(value.length);

        for (let i = 0; i < value.length; i++) {
            this.writeU8(value[i]);
        }
    }

    @inline
    public writeBytesU8Array(value: u8[]): void {
        this.allocSafe(value.length);

        for (let i = 0; i < value.length; i++) {
            this.writeU8(value[i]);
        }
    }

    public writeBytesWithLength(value: Uint8Array): void {
        const length: u32 = u32(value.length);

        this.allocSafe(length + U32_BYTE_LENGTH);
        this.writeU32(length);

        for (let i: u32 = 0; i < length; i++) {
            this.writeU8(value[i]);
        }
    }

    public writeString(value: string): void {
        for (let i: i32 = 0; i < value.length; i++) {
            this.writeU8(u8(value.charCodeAt(i)));
        }
    }

    public writeAddress(value: Address): void {
        const bytes = this.fromAddress(value);
        this.writeBytes(bytes);
    }

    public writeStringWithLength(value: string): void {
        this.writeU16(u16(value.length));

        this.writeString(value);
    }

    public writeAddressValueTupleMap(map: AddressMap<u256>): void {
        if (map.size > 65535) throw new Revert('Map size is too large');

        /*const requiredSize: u32 = U16_BYTE_LENGTH + map.size * (ADDRESS_BYTE_LENGTH + U256_BYTE_LENGTH);

        if (this.buffer.byteLength < requiredSize) {
            abort(
                `This buffer is too small. Required size: ${requiredSize} - Current size: ${this.buffer.byteLength}`,
            );
        }*/

        this.writeU16(u16(map.size));

        const keys = map.keys();
        for (let i = 0; i < keys.length; i++) {
            const key: Address = keys[i];
            const value: u256 = map.get(key) || u256.Zero;

            this.writeAddress(key);
            this.writeU256(value);
        }
    }

    public writeLimitedAddressBytesMap(map: AddressMap<Uint8Array[]>): void {
        if (map.size > 8) throw new Revert('Too many contract called.'); // no more than 8 different contracts.

        /*let requiredSize: u32 = U8_BYTE_LENGTH + (map.size * ADDRESS_BYTE_LENGTH + U8_BYTE_LENGTH);


        for (let i = 0; i < map.size; i++) {
            const address: Address = keys[i];
            const calls: Uint8Array[] = map.get(address) || [];

            for (let j: i32 = 0; j < calls.length; j++) {
                requiredSize += 4 + calls[j].length;
            }
        }

        if (this.buffer.byteLength < requiredSize) {
            abort(
                `This buffer is too small. Required size: ${requiredSize} - Current size: ${this.buffer.byteLength}`,
            );
        }*/

        const keys: Address[] = map.keys();

        this.writeU8(u8(map.size));

        for (let i: i32 = 0; i < keys.length; i++) {
            const address: Address = keys[i];
            const calls: Uint8Array[] = map.get(address) || [];

            if (calls.length > 10) throw new Revert('Too many calls.'); // no more than 16 different calls.

            this.writeAddress(address);
            this.writeU8(u8(calls.length));

            for (let j: i32 = 0; j < calls.length; j++) {
                this.writeBytesWithLength(calls[j]);
            }
        }
    }

    public writeMethodSelectorsMap(map: Selector[]): void {
        this.writeU16(u16(map.length));

        for (let i = 0; i < map.length; i++) {
            this.writeSelector(map[i]);
        }
    }

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

    public allocSafe(size: u32): void {
        if (this.currentOffset + size > u32(this.buffer.byteLength)) {
            const sizeDiff: u32 = size - (u32(this.buffer.byteLength) - this.currentOffset);

            this.resize(sizeDiff);
        }
    }

    public writeABISelector(name: string, selector: Selector): void {
        this.writeStringWithLength(name);
        this.writeSelector(selector);
    }

    private writeMethodSelectorMap(value: Set<Selector>): void {
        this.writeU16(u16(value.size));

        const keys = value.values();
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];

            this.writeSelector(key);
        }
    }

    private min(value1: i32, value2: i32): i32 {
        return value1 < value2 ? value1 : value2;
    }

    private fromAddress(pubKey: Address): Uint8Array {
        if (pubKey.byteLength > ADDRESS_BYTE_LENGTH) {
            throw new Revert(
                `Address is too long ${pubKey.byteLength} > ${ADDRESS_BYTE_LENGTH} bytes`,
            );
        }

        return pubKey;
    }

    private resize(size: u32): void {
        abort(
            `Buffer is getting resized. This is very bad for performance. Expected size: ${
                this.buffer.byteLength + size
            } - Current size: ${this.buffer.byteLength}`,
        );

        /*const buf: Uint8Array = new Uint8Array(u32(this.buffer.byteLength) + size);

        for (let i: i32 = 0; i < this.buffer.byteLength; i++) {
            buf[i] = this.buffer.getUint8(i);
        }

        this.buffer = new DataView(buf.buffer);*/
    }

    private getDefaultBuffer(length: i32 = 1): DataView {
        return new DataView(new ArrayBuffer(length));
    }
}
