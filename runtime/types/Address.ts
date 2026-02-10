import { Potential } from '../lang/Definitions';
import { ADDRESS_BYTE_LENGTH, decodeHexArray, encodeHexFromBuffer } from '../utils';
import { Revert } from './Revert';
import { loadMLDSAPublicKey } from '../env/global';
import { MLDSASecurityLevel } from '../env/consensus/MLDSAMetadata';
import { ArrayLike } from '../interfaces/as';

/**
 * Represents a 32-byte address in the OPNet system.
 *
 * This class extends Uint8Array to provide a fixed-size 32-byte address with additional
 * functionality for quantum-resistant cryptography. The address stores the SHA256 hash
 * of an ML-DSA public key and provides lazy loading of the full ML-DSA public key when
 * needed for signature verification.
 *
 * @remarks
 * Addresses are immutable once set - attempting to modify an address after construction
 * will throw an error. This ensures address integrity throughout the contract lifecycle.
 *
 * The class provides operator overloading for comparison operations, treating addresses
 * as big-endian 256-bit integers for ordering purposes.
 *
 * @example
 * ```typescript
 * // Create from hex string
 * const addr1 = Address.fromString('0x1234...abcd');
 *
 * // Create zero address
 * const zero = Address.zero();
 *
 * // Compare addresses
 * if (addr1 > zero) {
 *   // addr1 is greater than zero
 * }
 *
 * // Get ML-DSA public key for verification
 * const mldsaKey = addr1.mldsaPublicKey;
 * ```
 */
export class Address extends Uint8Array {
    /**
     * Indicates whether the address has been initialized with data.
     * Once true, the address becomes immutable.
     */
    protected isDefined: boolean = false;

    /**
     * Creates a new Address instance.
     *
     * @param bytes - Optional 32-byte array representing the address.
     *                If empty or not provided, creates a zero address.
     *
     * @throws {Revert} If bytes length is not exactly 32
     */
    public constructor(bytes: u8[] = []) {
        super(ADDRESS_BYTE_LENGTH);

        if (!(!bytes || bytes.length === 0)) {
            this.newSet(bytes);
        }
    }

    /**
     * Cached ML-DSA public key, loaded lazily when first accessed.
     */
    protected _mldsaPublicKey: Potential<Uint8Array> = null;

    /**
     * Gets the ML-DSA public key associated with this address.
     *
     * The full ML-DSA public key is loaded from storage on first access and cached
     * for subsequent uses. This key is used for quantum-resistant signature verification
     * when the consensus transitions away from Schnorr signatures.
     *
     * @returns The ML-DSA Level 2 (ML-DSA-44) public key for this address
     *
     * @remarks
     * The address itself stores only the SHA256 hash of the ML-DSA public key.
     * The full key (which is much larger, typically ~1312 bytes for Level 2)
     * is stored separately and loaded on demand for efficiency.
     */
    public get mldsaPublicKey(): Uint8Array {
        if (!this._mldsaPublicKey) {
            this._mldsaPublicKey = loadMLDSAPublicKey(this, MLDSASecurityLevel.Level2);
        }

        return this._mldsaPublicKey as Uint8Array;
    }

    /**
     * Creates a zero address (all 32 bytes are 0x00).
     *
     * @returns A new Address instance with all bytes set to zero
     *
     * @example
     * ```typescript
     * const zero = Address.zero();
     * console.log(zero.isZero()); // true
     * ```
     */
    public static zero(): Address {
        return ZERO_ADDRESS.clone();
    }

    /**
     * Creates an Address from a hexadecimal string representation.
     *
     * @param pubKey - The 32-byte address as a hexadecimal string.
     *                 Can be prefixed with '0x' or unprefixed.
     *
     * @returns A new Address instance
     *
     * @throws {Error} If the decoded hex string is not exactly 32 bytes
     * @throws {Error} If the string contains invalid hexadecimal characters
     *
     * @example
     * ```typescript
     * const addr1 = Address.fromString('0x' + '00'.repeat(32));
     * const addr2 = Address.fromString('deadbeef'.repeat(8));
     * ```
     */
    public static fromString(pubKey: string): Address {
        if (pubKey.startsWith('0x')) {
            pubKey = pubKey.slice(2);
        }

        return new Address(decodeHexArray(pubKey));
    }

    /**
     * Creates an Address from a Uint8Array using direct memory copy.
     *
     * This method is more efficient than the constructor for creating
     * addresses from existing Uint8Array data as it uses direct memory
     * copying instead of element-by-element copying.
     *
     * @param bytes - The source Uint8Array containing exactly 32 bytes
     *
     * @returns A new Address instance with data copied from the input
     *
     * @remarks
     * The input array must be exactly ADDRESS_BYTE_LENGTH (32) bytes.
     * This method performs a raw memory copy, so ensure the input is valid.
     */
    public static fromUint8Array(bytes: Uint8Array): Address {
        const cloned = new Address([]);

        // Copy the raw memory directly:
        memory.copy(cloned.dataStart, bytes.dataStart, ADDRESS_BYTE_LENGTH);

        return cloned;
    }

    /**
     * Checks if this address is the zero address.
     *
     * @returns `true` if all 32 bytes are zero, `false` otherwise
     *
     * @example
     * ```typescript
     * const addr = Address.zero();
     * console.log(addr.isZero()); // true
     * ```
     */
    public isZero(): bool {
        for (let i = 0; i < this.length; i++) {
            if (this[i] != 0) {
                return false;
            }
        }

        return true;
    }

    /**
     * Creates a deep copy of this Address.
     *
     * @returns A new Address instance with the same data and isDefined state
     *
     * @remarks
     * Uses direct memory copy for efficiency. The cloned address maintains
     * the same mutability state as the original.
     */
    public clone(): Address {
        const cloned = new Address([]);

        // Copy the raw memory directly:
        memory.copy(cloned.dataStart, this.dataStart, ADDRESS_BYTE_LENGTH);

        // Duplicate the isDefined flag as well:
        cloned.isDefined = this.isDefined;

        return cloned;
    }

    /**
     * Converts the address to a hexadecimal string representation.
     *
     * @returns The address as a lowercase hex string without '0x' prefix
     *
     * @example
     * ```typescript
     * const addr = Address.fromString('0xdead' + '00'.repeat(30));
     * console.log(addr.toHex()); // "dead" + "00".repeat(30)
     * ```
     */
    public toHex(): string {
        return encodeHexFromBuffer(this.buffer);
    }

    /**
     * Checks equality with another address (operator ==).
     *
     * @param a - The address to compare with
     * @returns `true` if both addresses have identical bytes, `false` otherwise
     */
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

    /**
     * Checks if this address is less than another (operator <).
     *
     * Comparison is done byte-by-byte treating addresses as big-endian 256-bit integers.
     *
     * @param a - The address to compare with
     * @returns `true` if this address is numerically less than `a`
     */
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

    /**
     * Checks if this address is greater than another (operator >).
     *
     * Comparison is done byte-by-byte treating addresses as big-endian 256-bit integers.
     *
     * @param a - The address to compare with
     * @returns `true` if this address is numerically greater than `a`
     */
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

    /**
     * Checks if this address is less than or equal to another (operator <=).
     *
     * @param a - The address to compare with
     * @returns `true` if this address is numerically less than or equal to `a`
     */
    @operator('<=')
    public lessThanOrEqual(a: Address): bool {
        return this.lessThan(a) || this.equals(a);
    }

    /**
     * Checks if this address is greater than or equal to another (operator >=).
     *
     * @param a - The address to compare with
     * @returns `true` if this address is numerically greater than or equal to `a`
     */
    @operator('>=')
    public greaterThanOrEqual(a: Address): bool {
        return this.greaterThan(a) || this.equals(a);
    }

    /**
     * Checks inequality with another address (operator !=).
     *
     * @param a - The address to compare with
     * @returns `true` if addresses have different bytes, `false` if identical
     */
    @operator('!=')
    public notEquals(a: Address): bool {
        return !this.equals(a);
    }

    /**
     * Returns the hexadecimal string representation of the address.
     *
     * @returns The address as a hex string (delegates to toHex())
     */
    public override toString(): string {
        return this.toHex();
    }

    /**
     * Sets the address data and marks it as immutable.
     *
     * @param publicKey - The 32-byte public key data
     *
     * @throws {Revert} If publicKey length is not exactly 32 bytes
     *
     * @private
     */
    private newSet<U extends ArrayLike<number>>(publicKey: U): void {
        if (publicKey.length !== 32) {
            throw new Revert(`Invalid public key length (${publicKey.length})`);
        }

        super.set(publicKey);

        this.isDefined = true;
    }

    /**
     * Array index getter (operator []).
     *
     * @param index - The byte index to access (0-31)
     * @returns The byte value at the specified index
     *
     * @throws {RangeError} If index is out of bounds
     *
     * @private
     */
    @operator('[]')
    // @ts-ignore
    private ___get(index: i32): u8 {
        if (u32(index) >= u32(this.length)) {
            throw new RangeError('Index out of range');
        }

        return load<u8>(this.dataStart + <usize>index);
    }

    /**
     * Array index setter (operator []=).
     *
     * @param index - The byte index to set (0-31)
     * @param value - The byte value to set
     *
     * @throws {Revert} If the address is already defined (immutable)
     * @throws {RangeError} If index is out of bounds
     *
     * @private
     */
    @operator('[]=')
    // @ts-ignore
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

/**
 * Pre-initialized zero address constant for efficiency.
 */
export const ZERO_ADDRESS: Address = new Address([]);

/**
 * Type alias for nullable Address references.
 */
export declare type PotentialAddress = Potential<Address>;
