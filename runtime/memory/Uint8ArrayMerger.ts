import { Blockchain } from '../env';
import { encodePointerUnknownLength } from '../math/abi';
import { BytesWriter } from '../buffer/BytesWriter';
import { u256 } from '@btc-vision/as-bignum/assembly';

@final
export class Uint8ArrayMerger {
    public parentKey: Uint8Array;

    public pointer: u16;

    constructor(
        parent: Uint8Array,
        pointer: u16,
        private readonly defaultValue: Uint8Array,
    ) {
        this.pointer = pointer;

        this.parentKey = parent;
    }

    public setAsUint8Array(key: Uint8Array, value: Uint8Array): this {
        const keyHash: Uint8Array = this.getKeyHash(key);
        Blockchain.setStorageAt(keyHash, value);

        return this;
    }

    public set(key: Uint8Array, value: u256): this {
        return this.setAsUint8Array(key, value.toUint8Array(true));
    }

    public getAsUint8Array(key: Uint8Array): Uint8Array {
        const keyHash: Uint8Array = this.getKeyHash(key);

        return Blockchain.getStorageAt(keyHash, this.defaultValue);
    }

    public get(key: Uint8Array): u256 {
        const data = this.getAsUint8Array(key);

        return u256.fromUint8ArrayBE(data);
    }

    public has(key: Uint8Array): bool {
        const mergedKey: Uint8Array = this.getKeyHash(key);

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

    private getKeyHash(key: Uint8Array): Uint8Array {
        const writer: BytesWriter = new BytesWriter(key.byteLength + this.parentKey.byteLength);

        writer.writeBytes(this.parentKey);
        writer.writeBytes(key);

        return this.encodePointer(writer);
    }

    private encodePointer(writer: BytesWriter): Uint8Array {
        return encodePointerUnknownLength(this.pointer, writer.getBuffer());
    }
}
