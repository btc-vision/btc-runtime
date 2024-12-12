import { MemorySlotPointer } from './MemorySlotPointer';
import { Blockchain } from '../env';
import { encodePointer } from '../math/abi';
import { MemorySlotData } from './MemorySlot';
import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesWriter } from '../buffer/BytesWriter';

@final
export class StringMemoryMap<K extends string, V extends MemorySlotData<u256>> {
    public pointer: u16;

    constructor(
        pointer: u16,
        private readonly defaultValue: V,
    ) {
        this.pointer = pointer;
    }

    public set(key: K, value: V): this {
        const keyHash: MemorySlotPointer = this.encodePointer(key);
        Blockchain.setStorageAt(keyHash, value);

        return this;
    }

    public get(key: K): MemorySlotData<u256> {
        const keyHash: MemorySlotPointer = this.encodePointer(key);

        return Blockchain.getStorageAt(keyHash, this.defaultValue);
    }

    public has(key: K): bool {
        const keyHash: MemorySlotPointer = this.encodePointer(key);

        return Blockchain.hasStorageAt(keyHash);
    }

    @unsafe
    public delete(key: K): bool {
        this.set(key, this.defaultValue);

        return true;
    }

    @unsafe
    public clear(): void {
        throw new Error('Method not implemented.');
    }

    private encodePointer(key: K): MemorySlotPointer {
        const writer = new BytesWriter(key.length);
        writer.writeString(key);

        return encodePointer(this.pointer, writer.getBuffer());
    }
}
