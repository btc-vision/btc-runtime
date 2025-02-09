import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesWriter } from '../buffer/BytesWriter';
import { Blockchain } from '../env';
import { encodePointer } from '../math/abi';
import { MemorySlotData } from './MemorySlot';
import { MemorySlotPointer } from './MemorySlotPointer';

@final
export class KeyMerger<K extends string, K2 extends string, V extends MemorySlotData<u256>> {
    public parentKey: K;
    public pointer: u16;

    constructor(parent: K, pointer: u16, private readonly defaultValue: V) {
        this.pointer = pointer;
        this.parentKey = parent;
    }

    public set(key2: K2, value: V): this {
        const mergedKey: string = this.mergeKey(key2);
        const keyHash: MemorySlotPointer = this.encodePointer(mergedKey);

        Blockchain.setStorageAt(keyHash, value);

        return this;
    }

    public get(key: K): MemorySlotData<u256> {
        const mergedKey: string = this.mergeKey(key);
        return Blockchain.getStorageAt(this.encodePointer(mergedKey), this.defaultValue);
    }

    public has(key: K): bool {
        const mergedKey: string = this.mergeKey(key);
        return Blockchain.hasStorageAt(this.encodePointer(mergedKey));
    }

    @unsafe
    public delete(_key: K): bool {
        throw new Error('Method not implemented.');
    }

    @unsafe
    public clear(): void {
        throw new Error('Clear method not implemented.');
    }

    /**
     * Merges the parentKey and the provided key by prefixing each with its length.
     * This avoids collisions such as:
     *   parentKey = "abc", key = "def"  => "3:abc3:def"
     *   parentKey = "ab",  key = "cdef" => "2:ab4:cdef"
     */
    private mergeKey(key: string): string {
        return `${this.parentKey.length}:${this.parentKey}${key.length}:${key}`;
    }

    private encodePointer(key: string): MemorySlotPointer {
        const writer = new BytesWriter(key.length);
        writer.writeString(key);

        return encodePointer(this.pointer, writer.getBuffer());
    }
}
