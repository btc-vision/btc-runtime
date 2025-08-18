import { BytesWriter } from '../buffer/BytesWriter';
import { Blockchain } from '../env';
import { encodePointerUnknownLength } from '../math/abi';
import { Revert } from '../types/Revert';

@final
export class KeyMerger<K extends string, K2 extends string, V extends Uint8Array> {
    public parentKey: K;
    public pointer: u16;

    constructor(parent: K, pointer: u16) {
        this.pointer = pointer;
        this.parentKey = parent;
    }

    public set(key2: K2, value: V): this {
        const mergedKey: string = this.mergeKey(key2);
        const keyHash: Uint8Array = this.encodePointer(mergedKey);

        Blockchain.setStorageAt(keyHash, value);

        return this;
    }

    public get(key: K2): Uint8Array {
        const mergedKey: string = this.mergeKey(key);
        return Blockchain.getStorageAt(this.encodePointer(mergedKey));
    }

    public has(key: K2): bool {
        const mergedKey: string = this.mergeKey(key);
        return Blockchain.hasStorageAt(this.encodePointer(mergedKey));
    }

    @unsafe
    public delete(_key: K2): bool {
        throw new Revert('Method not implemented.');
    }

    @unsafe
    public clear(): void {
        throw new Revert('Clear method not implemented.');
    }

    /**
     * Merges the parentKey and the provided key by prefixing each with its length.
     * This avoids collisions such as:
     *   parentKey = "abc", key = "def"  => "3:abc3:def"
     *   parentKey = "ab",  key = "cdef" => "2:ab4:cdef"
     */
    @inline
    private mergeKey(key: K2): string {
        return `${this.parentKey.length}:${this.parentKey}${key.length}:${key}`;
    }

    @inline
    private encodePointer(key: string): Uint8Array {
        const writer = new BytesWriter(key.length);
        writer.writeString(key);

        return encodePointerUnknownLength(this.pointer, writer.getBuffer());
    }
}
