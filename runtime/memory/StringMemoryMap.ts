import { Blockchain } from '../env';
import { encodePointerUnknownLength } from '../math/abi';
import { BytesWriter } from '../buffer/BytesWriter';
import { EMPTY_BUFFER } from '../math/bytes';

@final
export class StringMemoryMap<K extends string> {
    public pointer: u16;

    constructor(
        pointer: u16,
    ) {
        this.pointer = pointer;
    }

    @inline
    public set(key: K, value: Uint8Array): this {
        const keyHash: Uint8Array = this.encodePointer(key);
        Blockchain.setStorageAt(keyHash, value);

        return this;
    }

    @inline
    public get(key: K): Uint8Array {
        const keyHash: Uint8Array = this.encodePointer(key);

        return Blockchain.getStorageAt(keyHash);
    }

    @inline
    public has(key: K): bool {
        const keyHash: Uint8Array = this.encodePointer(key);

        return Blockchain.hasStorageAt(keyHash);
    }

    @unsafe
    public delete(key: K): bool {
        this.set(key, EMPTY_BUFFER);

        return true;
    }

    @unsafe
    public clear(): void {
        throw new Error('Method not implemented.');
    }

    private encodePointer(key: K): Uint8Array {
        const writer = new BytesWriter(key.length);
        writer.writeString(key);

        return encodePointerUnknownLength(this.pointer, writer.getBuffer());
    }
}
