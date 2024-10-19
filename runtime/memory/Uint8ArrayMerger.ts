import { MemorySlotData } from './MemorySlot';
import { u256 } from 'as-bignum/assembly';
import { Blockchain } from '../env';
import { MemorySlotPointer } from './MemorySlotPointer';
import { encodePointer } from '../math/abi';
import { BytesWriter } from '../buffer/BytesWriter';

@final
export class Uint8ArrayMerger<V extends MemorySlotData<u256>> {
    public parentKey: Uint8Array;

    public pointer: u16;

    constructor(
        parent: Uint8Array,
        pointer: u16,
        private readonly defaultValue: V,
    ) {
        this.pointer = pointer;

        this.parentKey = parent;
    }

    public set(key2: Uint8Array, value: V): this {
        const keyHash: MemorySlotPointer = this.getKeyHash(key2);
        Blockchain.setStorageAt(keyHash, value);

        return this;
    }

    public get(key: Uint8Array): MemorySlotData<u256> {
        const keyHash: MemorySlotPointer = this.getKeyHash(key);

        return Blockchain.getStorageAt(keyHash, this.defaultValue);
    }

    public has(key: Uint8Array): bool {
        const mergedKey: MemorySlotPointer = this.getKeyHash(key);

        return Blockchain.hasStorageAt(mergedKey);
    }

    @unsafe
    public delete(_key: Uint8Array): bool {
        throw new Error('Method not implemented.');
    }

    @unsafe
    public clear(): void {
        throw new Error('Clear method not implemented.');
    }

    private getKeyHash(key: Uint8Array): MemorySlotPointer {
        const writer: BytesWriter = new BytesWriter(key.byteLength + 2 + this.parentKey.byteLength);

        writer.writeBytes(this.parentKey);
        writer.writeBytes(key);

        return this.encodePointer(writer);
    }

    private encodePointer(writer: BytesWriter): MemorySlotPointer {
        writer.writeU16(this.pointer);

        return encodePointer(writer.getBuffer());
    }
}
