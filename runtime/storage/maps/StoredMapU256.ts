import { u256 } from '@btc-vision/as-bignum/assembly';
import { Blockchain } from '../../env';
import { EMPTY_BUFFER } from '../../math/bytes';
import { BytesWriter } from '../../buffer/BytesWriter';
import { encodePointerUnknownLength } from '../../math/abi';

/**
 * StoredMap<K, V> implementation using u256 as keys.
 */
@final
export class StoredMapU256 {
    private readonly pointer: u16;
    private readonly subPointer: Uint8Array;

    constructor(pointer: u16, subPointer: Uint8Array = new Uint8Array(30)) {
        this.pointer = pointer;
        this.subPointer = subPointer;
    }

    /**
     * Sets the value for a given key.
     * @param key - The key of type K.
     * @param value - The value of type V.
     */
    public set(key: u256, value: u256): void {
        const keyPointer = this.getKeyPointer(key);
        Blockchain.setStorageAt(keyPointer, value.toUint8Array(true));
    }

    /**
     * Retrieves the value for a given key.
     * @param key - The key of type K.
     * @returns The value of type V or null if the key does not exist.
     */
    public get(key: u256): u256 {
        const keyPointer = this.getKeyPointer(key);
        return u256.fromUint8ArrayBE(Blockchain.getStorageAt(keyPointer));
    }

    /**
     * Deletes the value for a given key.
     * @param key - The key of type K.
     */
    public delete(key: u256): void {
        const keyPointer = this.getKeyPointer(key);
        Blockchain.setStorageAt(keyPointer, EMPTY_BUFFER);
    }

    /**
     * Generates the storage pointer for a given key.
     * @param key - The key of type K.
     * @returns The storage pointer as u256.
     */
    private getKeyPointer(key: u256): Uint8Array {
        const writer = new BytesWriter(64);

        writer.writeBytes(this.subPointer);
        writer.writeU256(key);

        return encodePointerUnknownLength(this.pointer, writer.getBuffer());
    }
}
