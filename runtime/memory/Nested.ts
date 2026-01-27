import { Blockchain } from '../env';
import { encodePointerUnknownLength } from '../math/abi';
import { BytesWriter } from '../buffer/BytesWriter';
import { u256 } from '@btc-vision/as-bignum/assembly';
import { Address } from '../types/Address';
import { Revert } from '../types/Revert';
import { BytesReader } from '../buffer/BytesReader';

@final
export class Nested<T> {
    public parentKey: Uint8Array;

    public pointer: u16;

    constructor(parent: Uint8Array, pointer: u16) {
        this.pointer = pointer;

        this.parentKey = parent;
    }

    public set(key: Uint8Array, value: T): this {
        const keyHash: Uint8Array = this.getKeyHash(key);
        Blockchain.setStorageAt(keyHash, this.from(value));

        return this;
    }

    public get(key: Uint8Array): T {
        const keyHash: Uint8Array = this.getKeyHash(key);

        return this.toValue(Blockchain.getStorageAt(keyHash));
    }

    public has(key: Uint8Array): bool {
        const mergedKey: Uint8Array = this.getKeyHash(key);

        return Blockchain.hasStorageAt(mergedKey);
    }

    @unsafe
    public delete(_key: Uint8Array): bool {
        throw new Revert('Method not implemented.');
    }

    @unsafe
    public clear(): void {
        throw new Revert('Clear method not implemented.');
    }

    /**
     * Converts raw bytes from storage into type T.
     */
    private toValue(value: Uint8Array): T {
        // Check T's compile-time type ID
        if (idof<T>() == idof<u256>()) {
            // We know T is u256
            return changetype<T>(u256.fromUint8ArrayBE(value));
        } else if (idof<T>() == idof<Uint8Array>()) {
            // We know T is Uint8Array
            return changetype<T>(value);
        } else if (idof<T>() == idof<Address>()) {
            // We know T is Address
            return changetype<T>(value);
        } else if (isInteger<T>()) {
            const reader = new BytesReader(value);
            return reader.read<T>();
        } else if (isString<T>()) {
            // T is a string
            return changetype<T>(String.UTF8.decode(value.buffer));
        }

        throw new Revert('Unsupported type');
    }

    /**
     * Converts type T into raw bytes for storage.
     */
    private from(value: T): Uint8Array {
        if (idof<T>() == idof<u256>()) {
            // Cast T to u256, then convert to bytes
            return changetype<u256>(value).toUint8Array(true);
        } else if (idof<T>() == idof<Uint8Array>()) {
            // Just return it
            return changetype<Uint8Array>(value);
        } else if (idof<T>() == idof<Address>()) {
            // Address is already bytes
            return changetype<Uint8Array>(value);
        } else if (isInteger<T>()) {
            const writer = new BytesWriter(sizeof<T>());
            writer.write<T>(value);
            return writer.getBuffer();
        } else if (isString<T>()) {
            const str = changetype<string>(value);
            return Uint8Array.wrap(String.UTF8.encode(str));
        }

        throw new Revert('Unsupported type');
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
