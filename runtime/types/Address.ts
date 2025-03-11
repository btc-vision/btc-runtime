import { Potential } from '../lang/Definitions';
import { ADDRESS_BYTE_LENGTH, decodeHexArray, encodeHexFromBuffer } from '../utils';
import { bech32m as _bech32m, toWords } from '../utils/b32';
import { Revert } from './Revert';

@final
export class Address extends Uint8Array {
    private isDefined: boolean = false;

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
    public static dead(): Address {
        return DEAD_ADDRESS.clone();
    }

    public static zero(): Address {
        return ZERO_ADDRESS.clone();
    }

    public static fromString(pubKey: string): Address {
        if (pubKey.startsWith('0x')) {
            pubKey = pubKey.slice(2);
        }

        return new Address(decodeHexArray(pubKey));
    }

    public isZero(): bool {
        for (let i = 0; i < this.length; i++) {
            if (this[i] != 0) {
                return false;
            }
        }

        return true;
    }

    /**
     * Create a new Address that is a copy of the current Address.
     * @returns {Address}
     */
    public clone(): Address {
        const cloned = new Address();
        // Copy the raw memory directly:
        memory.copy(cloned.dataStart, this.dataStart, ADDRESS_BYTE_LENGTH);

        // Duplicate the isDefined flag as well:
        cloned.isDefined = this.isDefined;

        return cloned;
    }

    public static fromUint8Array(bytes: Uint8Array): Address {
        const cloned = new Address();
        // Copy the raw memory directly:
        memory.copy(cloned.dataStart, bytes.dataStart, ADDRESS_BYTE_LENGTH);

        return cloned;
    }

    public toHex(): string {
        return encodeHexFromBuffer(this.buffer);
    }

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

        super.set(publicKey);

        this.isDefined = true;
    }

    public toBech32m(): string {
        return String.UTF8.decode(_bech32m(String.UTF8.encode('bc'), toWords(this.buffer)));
    }

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

    @operator('<')
    public lessThan(a: Address): bool {
        // Compare the two addresses byte-by-byte, treating them as big-endian uint256
        for (let i = 0; i < 32; i++) {
            const thisByte = this[i];
            const aByte = a[i];

            if (thisByte < aByte) {
                return true; // this is less than a
            } else if (thisByte > aByte) {
                return false; // this is greater than or equal to a
            }
        }

        return false;
    }

    @operator('>')
    public greaterThan(a: Address): bool {
        // Compare the two addresses byte-by-byte, treating them as big-endian uint256
        for (let i = 0; i < 32; i++) {
            const thisByte = this[i];
            const aByte = a[i];

            if (thisByte > aByte) {
                return true; // this is greater than a
            } else if (thisByte < aByte) {
                return false; // this is less than or equal to a
            }
        }

        return false;
    }

    @operator('<=')
    public lessThanOrEqual(a: Address): bool {
        return this.lessThan(a) || this.equals(a);
    }

    @operator('>=')
    public greaterThanOrEqual(a: Address): bool {
        return this.greaterThan(a) || this.equals(a);
    }

    @operator('!=')
    public notEquals(a: Address): bool {
        return !this.equals(a);
    }

    public toString(): string {
        return this.toBech32m();
    }

    @operator('[]')
    private ___get(index: i32): u8 {
        if (u32(index) >= u32(this.length)) {
            throw new RangeError('Index out of range');
        }

        return load<u8>(this.dataStart + <usize>index);
    }

    @operator('[]=')
    private ___set(index: i32, value: u8): void {
        if (this.isDefined) {
            throw new Revert(`Cannot modify address data.`);
        }

        if (u32(index) >= u32(this.length)) {
            throw new RangeError('Index out of range');
        }

        store<u8>(this.dataStart + <usize>index, value);
    }
}

export const ZERO_ADDRESS: Address = new Address();
export const DEAD_ADDRESS: Address = new Address([
    40, 74, 228, 172, 219, 50, 169, 155, 163, 235, 250, 102, 169, 29, 219, 65, 167, 183, 161, 210,
    254, 244, 21, 57, 153, 34, 205, 138, 4, 72, 92, 2,
]);

export declare type PotentialAddress = Potential<Address>;
