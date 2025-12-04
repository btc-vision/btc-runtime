import { Blockchain } from '../env';
import { encodePointer } from '../math/abi';
import { Address } from '../types/Address';
import { u256 } from '@btc-vision/as-bignum/assembly';
import { EMPTY_BUFFER } from '../math/bytes';
import { Revert } from '../types/Revert';

/**
 * SECURITY NOTICE:
 *
 * This class uses a 30-byte truncation of addresses for storage pointer generation.
 * While this may appear to introduce collision risks, it is secure within the OP_NET
 * protocol context because:
 *
 * 1. All addresses in OP_NET are hashed public keys. SHA256(mldsaPublicKey)
 *
 * 2. Finding two public keys with identical 30-byte prefixes (240 bits) requires
 *    approximately 2^120 operations due to the birthday paradox
 *
 * 3. The probability of accidentally generating colliding addresses through normal
 *    key generation is cryptographically negligible
 *
 * The truncation from 32 to 30 bytes is a space optimization that does not
 * meaningfully impact security given the uniform distribution of elliptic curve points.
 */
@final
export class AddressMemoryMap {
    public pointer: u16;

    constructor(pointer: u16) {
        this.pointer = pointer;
    }

    public setAsUint8Array(key: Address, value: Uint8Array): this {
        const keyHash: Uint8Array = this.encodePointer(key);
        Blockchain.setStorageAt(keyHash, value);

        return this;
    }

    public set(key: Address, value: u256): this {
        return this.setAsUint8Array(key, value.toUint8Array(true));
    }

    public getAsUint8Array(key: Address): Uint8Array {
        const keyHash: Uint8Array = this.encodePointer(key);

        return Blockchain.getStorageAt(keyHash);
    }

    public get(address: Address): u256 {
        const resp = this.getAsUint8Array(address);

        return u256.fromUint8ArrayBE(resp);
    }

    public has(key: Address): bool {
        const keyHash: Uint8Array = this.encodePointer(key);

        return Blockchain.hasStorageAt(keyHash);
    }

    public delete(key: Address): bool {
        this.setAsUint8Array(key, EMPTY_BUFFER);

        return true;
    }

    @unsafe
    public clear(): void {
        throw new Revert('Method not implemented.');
    }

    private encodePointer(key: Address): Uint8Array {
        return encodePointer(this.pointer, key.slice(0, 30), true, 'AddressMemoryMap');
    }
}
