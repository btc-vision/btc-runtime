import { Potential } from '../lang/Definitions';
import { ADDRESS_BYTE_LENGTH, decodeHexArray, encodeHexFromBuffer } from '../utils';
import { Revert } from './Revert';
import { loadMLDSAPublicKey } from '../env/global';
import { MLDSASecurityLevel } from '../env/consensus/MLDSAMetadata';
import { ArrayLike } from '../interfaces/as';

export class Address extends Uint8Array {
    protected isDefined: boolean = false;

    public constructor(bytes: u8[] = []) {
        super(ADDRESS_BYTE_LENGTH);

        if (!(!bytes || bytes.length === 0)) {
            this.newSet(bytes);
        }
    }

    protected _mldsaPublicKey: Potential<Uint8Array> = null;

    /**
     * Get the MLDSA public key for this address
     * @returns {Uint8Array} The MLDSA public key
     */
    public get mldsaPublicKey(): Uint8Array {
        if (!this._mldsaPublicKey) {
            this._mldsaPublicKey = loadMLDSAPublicKey(this, MLDSASecurityLevel.Level2);
        }

        return this._mldsaPublicKey as Uint8Array;
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

    public static fromUint8Array(bytes: Uint8Array): Address {
        const cloned = new Address([]);
        // Copy the raw memory directly:
        memory.copy(cloned.dataStart, bytes.dataStart, ADDRESS_BYTE_LENGTH);

        return cloned;
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
        const cloned = new Address([]);

        // Copy the raw memory directly:
        memory.copy(cloned.dataStart, this.dataStart, ADDRESS_BYTE_LENGTH);

        // Duplicate the isDefined flag as well:
        cloned.isDefined = this.isDefined;

        return cloned;
    }

    public toHex(): string {
        return encodeHexFromBuffer(this.buffer);
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
        return this.toHex();
    }

    /**
     * Set the public key
     * @param {ArrayLike} publicKey The public key
     * @returns {void}
     */
    private newSet<U extends ArrayLike<number>>(publicKey: U): void {
        if (publicKey.length !== 32) {
            throw new Revert(`Invalid public key length (${publicKey.length})`);
        }

        super.set(publicKey);

        this.isDefined = true;
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

export const ZERO_ADDRESS: Address = new Address([]);

export declare type PotentialAddress = Potential<Address>;
