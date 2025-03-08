import { Blockchain } from '../env';
import { encodePointer } from '../math/abi';
import { Address } from '../types/Address';
import { u256 } from '@btc-vision/as-bignum/assembly';

@final
export class AddressMemoryMap {
    public pointer: u16;

    constructor(
        pointer: u16,
        private readonly defaultValue: Uint8Array,
    ) {
        this.pointer = pointer;
    }

    @inline
    public setAsUint8Array(key: Address, value: Uint8Array): this {
        const keyHash: Uint8Array = this.encodePointer(key);
        Blockchain.setStorageAt(keyHash, value);

        return this;
    }

    @inline
    public set(key: Address, value: u256): this {
        return this.setAsUint8Array(key, value.toUint8Array(true));
    }

    @inline
    public getAsUint8Array(key: Address): Uint8Array {
        const keyHash: Uint8Array = this.encodePointer(key);

        return Blockchain.getStorageAt(keyHash, this.defaultValue);
    }

    @inline
    public get(address: Address): u256 {
        const resp = this.getAsUint8Array(address);

        return u256.fromUint8ArrayBE(resp);
    }

    @inline
    public has(key: Address): bool {
        const keyHash: Uint8Array = this.encodePointer(key);

        return Blockchain.hasStorageAt(keyHash);
    }

    @unsafe
    public delete(key: Address): bool {
        this.setAsUint8Array(key, this.defaultValue);

        return true;
    }

    @unsafe
    public clear(): void {
        throw new Error('Method not implemented.');
    }

    private encodePointer(key: Address): Uint8Array {
        return encodePointer(this.pointer, key, false);
    }
}
