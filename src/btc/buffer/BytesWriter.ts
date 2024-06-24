import { u256 } from 'as-bignum/assembly';
import { Address, ADDRESS_BYTE_LENGTH } from '../types/Address';
import { Selector } from '../math/abi';
import { BytesReader } from './BytesReader';
import { SelectorsMap } from '../universal/ABIRegistry';
import { MemorySlotPointer } from '../memory/MemorySlotPointer';
import { MemorySlotData } from '../memory/MemorySlot';
import { BlockchainStorage, PointerStorage } from '../env/BTCEnvironment';
import { cyrb53a } from '../math/cyrb53';
import { Revert } from '../types/Revert';
import { Map } from '../generic/Map';

export enum BufferDataType {
    U8 = 0,
    U16 = 1,
    U32 = 2,
    U64 = 3,
    U256 = 4,
    ADDRESS = 5,
    STRING = 6,
    BOOLEAN = 7,
}

@final
export class BytesWriter {
    private currentOffset: u32 = 0;
    private buffer: DataView;

    private selectorDatatype: u8[] = [];

    constructor(length: i32 = 1, private readonly trackDataTypes: boolean = false) {
        this.buffer = new DataView(new ArrayBuffer(length));
    }

    public bufferLength(): u32 {
        return this.buffer.byteLength;
    }

    public writeU8(value: u8): void {
        if (this.trackDataTypes) this.selectorDatatype.push(u8(BufferDataType.U8));

        this.allocSafe(1);
        this.buffer.setUint8(this.currentOffset++, value);
    }

    public writeU16(value: u16): void {
        if (this.trackDataTypes) this.selectorDatatype.push(u8(BufferDataType.U16));

        this.allocSafe(2);
        this.buffer.setUint16(this.currentOffset, value, true);
        this.currentOffset += 2;
    }

    public writeU32(value: u32, le: boolean = true): void {
        if (this.trackDataTypes) this.selectorDatatype.push(u8(BufferDataType.U32));

        this.allocSafe(4);
        this.buffer.setUint32(this.currentOffset, value, le);
        this.currentOffset += 4;
    }

    public writeU64(value: u64): void {
        if (this.trackDataTypes) this.selectorDatatype.push(u8(BufferDataType.U64));

        this.allocSafe(8);
        this.buffer.setUint64(this.currentOffset, value || 0, true);
        this.currentOffset += 8;
    }

    public writeStorage(storage: BlockchainStorage): void {
        this.writeU32(storage.size);

        const keys: Address[] = storage.keys();
        const values: PointerStorage[] = storage.values();

        for (let i: i32 = 0; i < keys.length; i++) {
            const address: Address = keys[i];
            const storage: PointerStorage = values[i];

            this.writeAddress(address);

            const subKeys: MemorySlotPointer[] = storage.keys();
            const subValues: MemorySlotData<u256>[] = storage.values();

            this.writeU32(subKeys.length);

            for (let j: i32 = 0; j < subKeys.length; j++) {
                const pointer: MemorySlotPointer = subKeys[j];
                const value: MemorySlotData<u256> = subValues[j];

                this.writeU256(pointer);
                this.writeU256(value);
            }
        }
    }

    public writeSelector(value: Selector): void {
        this.writeU32(value, false);
    }

    public writeBoolean(value: boolean): void {
        if (this.trackDataTypes) this.selectorDatatype.push(u8(BufferDataType.BOOLEAN));

        this.writeU8(value ? 1 : 0);
    }

    public writeU256(value: u256): void {
        if (this.trackDataTypes) this.selectorDatatype.push(u8(BufferDataType.U256));
        this.allocSafe(32);

        const bytes = value.toUint8Array(true);
        for (let i: i32 = 0; i < 32; i++) {
            this.writeU8(bytes[i] || 0);
        }
    }

    public writeTuple(value: u256[]): void {
        this.allocSafe(4 + value.length * 32);
        this.writeU32(u32(value.length));

        for (let i = 0; i < value.length; i++) {
            this.writeU256(value[i]);
        }
    }

    public writeBytes(value: Uint8Array): void {
        this.allocSafe(value.length);

        for (let i = 0; i < value.length; i++) {
            this.writeU8(value[i]);
        }
    }

    public writeBytesWithLength(value: Uint8Array): void {
        const length: u32 = u32(value.byteLength);
        this.allocSafe(length + 4);
        this.writeU32(length);

        for (let i: u32 = 0; i < length; i++) {
            this.writeU8(value[i]);
        }
    }

    public writeString(value: string): void {
        if (this.trackDataTypes) this.selectorDatatype.push(u8(BufferDataType.STRING));

        for (let i: i32 = 0; i < value.length; i++) {
            this.writeU8(u8(value.charCodeAt(i)));
        }
    }

    public writeAddress(value: Address): void {
        if (this.trackDataTypes) this.selectorDatatype.push(u8(BufferDataType.ADDRESS));

        const bytes = this.fromAddress(value);
        this.writeBytes(bytes);
    }

    public writeStringWithLength(value: string): void {
        this.writeU16(u16(value.length));

        this.writeString(value);
    }

    public writeViewSelectorMap(map: SelectorsMap): void {
        this.writeU16(u16(map.size));

        const keys = map.keys();
        for (let i = 0; i < keys.length; i++) {
            const key: u32 = keys[i] as u32;
            const value = map.get(key);

            this.writeBytes(value);
        }
    }

    public writeAddressValueTupleMap(map: Map<Address, u256>): void {
        if (map.size > 65535) throw new Revert('Map size is too large');
        this.writeU16(u16(map.size));

        const keys = map.keys();
        for (let i = 0; i < keys.length; i++) {
            const key: Address = keys[i];
            const value: u256 = map.get(key) || u256.Zero;

            this.writeAddress(key);
            this.writeU256(value);
        }
    }

    public writeLimitedAddressBytesMap(map: Map<Address, Uint8Array[]>): void {
        if (map.size > 8) throw new Revert('Too many contract called.'); // no more than 8 different contracts.

        this.writeU8(u8(map.size));

        const keys: Address[] = map.keys();
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

    public getBuffer(clear: boolean = true): Uint8Array {
        const buf = new Uint8Array(this.buffer.byteLength);
        for (let i: u32 = 0; i < u32(this.buffer.byteLength); i++) {
            buf[i] = this.buffer.getUint8(i);
        }

        if (clear) this.clear();

        return buf;
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

    public clear(): void {
        this.currentOffset = 0;
        this.buffer = this.getDefaultBuffer();
        this.selectorDatatype = [];
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

    public getSelectorDataType(): u64 {
        let hash: u64 = 0;
        if (this.selectorDatatype.length === 0) return hash;

        return cyrb53a(this.selectorDatatype);
    }

    private getChecksum(): u32 {
        let checksum: u32 = 0;
        for (let i = 0; i < this.buffer.byteLength; i++) {
            checksum += this.buffer.getUint8(i);
        }

        return checksum % (2 ** 32);
    }

    private writeMethodSelectorMap(value: Set<Selector>): void {
        this.writeU16(u16(value.size));

        const keys = value.values();
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];

            this.writeSelector(key);
        }
    }

    private fromAddress(value: Address): Uint8Array {
        if (value.length > i32(ADDRESS_BYTE_LENGTH)) {
            throw new Revert('Address is too long');
        }

        const bytes: Uint8Array = new Uint8Array(ADDRESS_BYTE_LENGTH);
        for (let i: i32 = 0; i < value.length; i++) {
            bytes[i] = value.charCodeAt(i);
        }

        for (let i: u8 = u8(value.length); i < ADDRESS_BYTE_LENGTH; i++) {
            bytes[i] = 0;
        }

        return bytes;
    }

    private resize(size: u32): void {
        const buf: Uint8Array = new Uint8Array(u32(this.buffer.byteLength) + size);

        for (let i: i32 = 0; i < this.buffer.byteLength; i++) {
            buf[i] = this.buffer.getUint8(i);
        }

        this.buffer = new DataView(buf.buffer);
    }

    private getDefaultBuffer(length: i32 = 1): DataView {
        return new DataView(new ArrayBuffer(length));
    }
}
