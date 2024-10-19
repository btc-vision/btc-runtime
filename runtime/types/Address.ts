import { Potential } from '../lang/Definitions';
import { bech32m as _bech32m, toWords } from '../utils/b32';
import { decodeHexArray } from '../utils';

export const ADDRESS_BYTE_LENGTH: i32 = 32;

@final
export class Address extends Uint8Array {
    public constructor(bytes: u8[] = []) {
        super(ADDRESS_BYTE_LENGTH);

        if (!(!bytes || bytes.length === 0)) {
            this.newSet(bytes);
        }
    }

    /**
     * Dead address (284ae4acdb32a99ba3ebfa66a91ddb41a7b7a1d2fef415399922cd8a04485c02)
     * generated from 04678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5f
     */
    @inline
    public static dead(): Address {
        return new Address([
            40, 74, 228, 172, 219, 50, 169, 155, 163, 235, 250, 102, 169, 29, 219, 65, 167, 183,
            161, 210, 254, 244, 21, 57, 153, 34, 205, 138, 4, 72, 92, 2,
        ]);
    }

    @inline
    public static fromString(pubKey: string): Address {
        if (pubKey.startsWith('0x')) {
            pubKey = pubKey.slice(2);
        }

        return new Address(decodeHexArray(pubKey));
    }

    @inline
    public empty(): bool {
        for (let i = 0; i < this.length; i++) {
            if (this[i] != 0) {
                return false;
            }
        }

        return true;
    }

    /**
     * Set the public key
     * @param {ArrayLike} publicKey The public key
     * @returns {void}
     */
    public newSet(publicKey: u8[]): void {
        if (publicKey.length !== 32) {
            throw new Error('Invalid public key length');
        }

        this.set(publicKey);
    }

    @inline
    public toBech32m(): string {
        return String.UTF8.decode(_bech32m(String.UTF8.encode('bc'), toWords(this.buffer)));
    }

    @inline
    @operator('==')
    public equals(a: Address): bool {
        if (a.length != this.length) {
            return false;
        }

        for (let i = 0; i < this.length; i++) {
            if (this[i] != a[i]) {
                return false;
            }
        }

        return true;
    }

    @inline
    @operator('!=')
    public notEquals(a: Address): bool {
        return !this.equals(a);
    }
}

export declare type PotentialAddress = Potential<Address>;
