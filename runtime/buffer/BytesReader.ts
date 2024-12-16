import { i128, u128, u256 } from '@btc-vision/as-bignum/assembly';
import { TransactionInput, TransactionOutput } from '../env/classes/UTXO';
import { AddressMap } from '../generic/AddressMap';
import { Selector } from '../math/abi';
import { i256 } from '../math/i256';
import { Address } from '../types/Address';
import { Revert } from '../types/Revert';
import {
    ADDRESS_BYTE_LENGTH,
    I128_BYTE_LENGTH,
    I256_BYTE_LENGTH,
    I64_BYTE_LENGTH,
    U128_BYTE_LENGTH,
    U16_BYTE_LENGTH,
    U256_BYTE_LENGTH,
    U32_BYTE_LENGTH,
    U64_BYTE_LENGTH,
    U8_BYTE_LENGTH,
} from '../utils/lengths';

@final
export class BytesReader {
    private readonly buffer: DataView;

    private currentOffset: i32 = 0;

    constructor(bytes: Uint8Array) {
        this.buffer = new DataView(bytes.buffer);
    }

    public readU8(): u8 {
        this.verifyEnd(this.currentOffset + U8_BYTE_LENGTH);

        return this.buffer.getUint8(this.currentOffset + U8_BYTE_LENGTH);
    }

    public readU16(): u16 {
        this.verifyEnd(this.currentOffset + U16_BYTE_LENGTH);

        const value = this.buffer.getUint16(this.currentOffset, true);
        this.currentOffset += U16_BYTE_LENGTH;

        return value;
    }

    public readU32(le: boolean = true): u32 {
        this.verifyEnd(this.currentOffset + U32_BYTE_LENGTH);

        const value = this.buffer.getUint32(this.currentOffset, le);
        this.currentOffset += U32_BYTE_LENGTH;
        return value;
    }

    public readU64(): u64 {
        this.verifyEnd(this.currentOffset + U64_BYTE_LENGTH);

        const value = this.buffer.getUint64(this.currentOffset, true);
        this.currentOffset += U64_BYTE_LENGTH;

        return value;
    }

    public readU256(): u256 {
        this.verifyEnd(this.currentOffset + U256_BYTE_LENGTH);

        const next32Bytes: u8[] = this.readBytesBE(U256_BYTE_LENGTH);

        return u256.fromBytesBE(next32Bytes);
    }

    @inline
    public readBytesBE(count: i32): u8[] {
        const next32Bytes: u8[] = [];
        for (let i = 0; i < count; i++) {
            next32Bytes[i] = this.readU8();
        }

        return next32Bytes;
    }

    public readI64(): i64 {
        this.verifyEnd(this.currentOffset + I64_BYTE_LENGTH);

        const value = this.buffer.getInt64(this.currentOffset, true);
        this.currentOffset += I64_BYTE_LENGTH;

        return value;
    }

    public readU128(): u128 {
        this.verifyEnd(this.currentOffset + U128_BYTE_LENGTH);

        const next16Bytes: u8[] = this.readBytesBE(U128_BYTE_LENGTH);

        return u128.fromBytesBE(next16Bytes);
    }

    public readI128(): i128 {
        this.verifyEnd(this.currentOffset + I128_BYTE_LENGTH);

        const next16Bytes: u8[] = this.readBytesBE(I128_BYTE_LENGTH);

        return i128.fromBytesBE(next16Bytes);
    }

    public readBytes(length: u32, zeroStop: boolean = false): Uint8Array {
        let bytes: Uint8Array = new Uint8Array(length);
        for (let i: u32 = 0; i < length; i++) {
            const byte: u8 = this.readU8();
            if (zeroStop && byte === 0) {
                bytes = bytes.slice(0, i);
                break;
            }

            bytes[i] = byte;
        }

        return bytes;
    }

    public readMultiBytesAddressMap(): AddressMap<Uint8Array[]> {
        const map: AddressMap<Uint8Array[]> = new AddressMap<Uint8Array[]>();
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

    public readTransactionInputs(): TransactionInput[] {
        const length = this.readU8();
        const result = new Array<TransactionInput>(length);

        for (let i: u16 = 0; i < length; i++) {
            const txId = this.readBytes(32);
            const outputIndex = this.readU8();
            const scriptSig = this.readBytesWithLength();

            result[i] = new TransactionInput(txId, outputIndex, scriptSig);
        }

        return result;
    }

    public readTransactionOutputs(): TransactionOutput[] {
        const length = this.readU8();
        const result = new Array<TransactionOutput>(length);

        for (let i: u16 = 0; i < length; i++) {
            const index = this.readU8();
            const scriptPubKey = this.readStringWithLength();
            const value = this.readU64();

            result[i] = new TransactionOutput(index, scriptPubKey, value);
        }

        return result;
    }

    public readI256(): i256 {
        this.verifyEnd(this.currentOffset + I256_BYTE_LENGTH);

        const next32Bytes: u8[] = this.readBytesBE(I256_BYTE_LENGTH);

        return i256.fromBytesBE(next32Bytes);
    }

    public readTuple(): u256[] {
        const length = this.readU32();
        const result: u256[] = new Array<u256>(length);

        for (let i: u32 = 0; i < length; i++) {
            result[i] = this.readU256();
        }

        return result;
    }

    public readU128Array(): u128[] {
        const length = this.readU16();
        const result: u128[] = new Array<u128>(length);

        for (let i: u16 = 0; i < length; i++) {
            result[i] = this.readU128();
        }

        return result;
    }

    public readAddressValueTuple(): AddressMap<u256> {
        const length: u16 = this.readU16();
        const result = new AddressMap<u256>();

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
        const bytes: Address = new Address();
        for (let i: u32 = 0; i < u32(ADDRESS_BYTE_LENGTH); i++) {
            bytes[i] = this.readU8();
        }

        return bytes;
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

    public readAddressArray(): Address[] {
        const length = this.readU16();
        const result = new Array<Address>(length);

        for (let i: u16 = 0; i < length; i++) {
            result[i] = this.readAddress();
        }

        return result;
    }
}
