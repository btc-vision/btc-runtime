import { ICodec } from '../interfaces/ICodec';
import { BytesWriter } from '../../buffer/BytesWriter';
import { encodePointerUnknownLength } from '../../math/abi';
import { Blockchain } from '../../env';

export class StorageSet<T> {
    private readonly pointer: u16;
    private readonly parentKey: Uint8Array;

    private elementCodec: ICodec<T>;

    constructor(pointer: u16, parentKey: Uint8Array, elementCodec: ICodec<T>) {
        this.pointer = pointer;
        this.parentKey = parentKey;
        this.elementCodec = elementCodec;
    }

    public add(value: T): void {
        const storageKey = this.getStorageKey(value);

        // A 1-byte array with a single 0x01 is enough to mark presence
        const flag = new Uint8Array(1);
        flag[31] = 1;

        Blockchain.setStorageAt(storageKey, flag);
    }

    public has(value: T): bool {
        const storageKey = this.getStorageKey(value);
        return Blockchain.hasStorageAt(storageKey);
    }

    public delete(value: T): bool {
        const storageKey = this.getStorageKey(value);
        if (!Blockchain.hasStorageAt(storageKey)) {
            return false;
        }

        Blockchain.setStorageAt(storageKey, new Uint8Array(32));
        return true;
    }

    @unsafe
    public clear(): void {
        throw new Error('clear() not implemented.');
    }

    private getStorageKey(value: T): Uint8Array {
        const encoded = this.elementCodec.encode(value);
        const writer = new BytesWriter(this.parentKey.length + encoded.length);
        writer.writeBytes(this.parentKey);
        writer.writeBytes(encoded);

        return encodePointerUnknownLength(this.pointer, writer.getBuffer());
    }
}
