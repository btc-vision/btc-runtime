import { Potential } from '../lang/Definitions';
import { decodeHexArray } from '../utils';
import { Blockchain } from '../env';
import { Network } from '../script/Networks';
import { Address } from './Address';
import { BitcoinAddresses } from '../script/BitcoinAddresses';
import {
    DEAD_ARRAY,
    getCachedDeadAddress,
    getCachedZeroAddress,
    setCachedDeadAddress,
    setCachedZeroAddress,
    ZERO_ARRAY,
} from './ExtendedAddressCache';
import { Revert } from './Revert';

/**
 * Extended address implementation for Bitcoin with dual-key support.
 *
 * ExtendedAddress combines both Schnorr (taproot) and ML-DSA public keys to provide
 * a migration path from classical to quantum-resistant cryptography. The address
 * stores the ML-DSA public key hash (inherited from Address) and additionally
 * maintains the tweaked Schnorr public key for Bitcoin taproot compatibility.
 *
 * @remarks
 * This class is marked as @final and cannot be extended. It represents the complete
 * address format for OPNet's quantum-resistant transition, supporting both legacy
 * Schnorr signatures and future ML-DSA signatures within the same address structure.
 *
 * The tweaked public key enables P2TR (pay-to-taproot) address generation while
 * the ML-DSA key hash provides quantum resistance when consensus transitions.
 *
 * @example
 * ```typescript
 * // Create from hex strings
 * const addr = ExtendedAddress.fromStringPair(
 *   '0x' + '11'.repeat(32), // tweaked Schnorr key
 *   '0x' + '22'.repeat(32)  // ML-DSA key hash
 * );
 *
 * // Generate P2TR address
 * const bitcoinAddr = addr.p2tr();
 *
 * // Check if address is dead/zero
 * if (addr.isDead()) {
 *   // Handle dead address
 * }
 * ```
 */
@final
export class ExtendedAddress extends Address {
    /**
     * The 32-byte tweaked Schnorr public key for taproot compatibility.
     * This key is used for P2TR address generation and Schnorr signature verification.
     */
    public readonly tweakedPublicKey: Uint8Array;

    /**
     * Creates a new ExtendedAddress instance.
     *
     * @param tweakedPublicKey - 32-byte tweaked Schnorr public key for taproot
     * @param publicKey - 32-byte ML-DSA public key hash (SHA256 of full ML-DSA key)
     *
     * @throws {Revert} If tweakedPublicKey is not exactly 32 bytes
     * @throws {Revert} If publicKey is not exactly 32 bytes (thrown by parent class)
     */
    public constructor(tweakedPublicKey: u8[], publicKey: u8[]) {
        super(publicKey);

        if (tweakedPublicKey.length !== 32) {
            throw new Revert('Tweaked public key must be 32 bytes long');
        }

        this.tweakedPublicKey = new Uint8Array(32);
        this.tweakedPublicKey.set(tweakedPublicKey);
    }

    /**
     * Returns the canonical dead address.
     *
     * The dead address (284ae4acdb32a99ba3ebfa66a91ddb41a7b7a1d2fef415399922cd8a04485c02)
     * is generated from the uncompressed public key:
     * 04678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5f
     *
     * This address is commonly used as a burn address or null recipient in contracts.
     *
     * @returns A clone of the predefined DEAD_ADDRESS constant
     *
     * @example
     * ```typescript
     * const burnAddr = ExtendedAddress.dead();
     * if (recipient.isDead()) {
     *   // Tokens are being burned
     * }
     * ```
     */
    public static dead(): ExtendedAddress {
        let cached = getCachedDeadAddress();
        if (cached === 0) {
            const addr = new ExtendedAddress(DEAD_ARRAY, ZERO_ARRAY);
            cached = changetype<usize>(addr);
            setCachedDeadAddress(cached);
        }
        return changetype<ExtendedAddress>(cached).clone();
    }

    /**
     * Returns the zero address with all bytes set to 0x00.
     *
     * @returns A clone of the predefined ZERO_BITCOIN_ADDRESS constant
     *
     * @example
     * ```typescript
     * const zero = ExtendedAddress.zero();
     * if (addr.isZero()) {
     *   // Handle uninitialized address
     * }
     * ```
     */
    public static override zero(): ExtendedAddress {
        let cached = getCachedZeroAddress();
        if (cached === 0) {
            const addr = new ExtendedAddress(ZERO_ARRAY, ZERO_ARRAY);
            cached = changetype<usize>(addr);
            setCachedZeroAddress(cached);
        }
        return changetype<ExtendedAddress>(cached).clone();
    }

    /**
     * Disabled method - use fromStringPair instead.
     *
     * This method is intentionally disabled for ExtendedAddress to prevent
     * accidental creation with only one key. ExtendedAddress requires both
     * the tweaked Schnorr key and ML-DSA key hash for proper functionality.
     *
     * @param _ - Unused parameter
     *
     * @throws {Error} Always throws with instruction to use fromStringPair
     *
     * @deprecated Use {@link fromStringPair} instead
     */
    public static override fromString(_: string): ExtendedAddress {
        ERROR(
            `Use ExtendedAddress.fromStringPair instead. This method is disabled. You must provide both the tweaked public key and the ML-DSA public key.`,
        );
    }

    /**
     * Creates an ExtendedAddress from hexadecimal string representations of both keys.
     *
     * This is the preferred factory method for creating ExtendedAddress instances when
     * both the Schnorr tweaked public key and ML-DSA public key are available as strings.
     * Unlike the single-parameter fromString method (which maintains backward compatibility
     * with the base Address class), this method properly initializes both key components
     * required for full ExtendedAddress functionality.
     *
     * @param tweakedPubKey - The 32-byte Schnorr tweaked public key as a hexadecimal string.
     *                        Can be prefixed with '0x' or unprefixed. Must decode to exactly
     *                        32 bytes for taproot compatibility.
     * @param mldsaPubKey - The 32-byte ML-DSA public key hash (SHA256 of the full ML-DSA public key)
     *                      as a hexadecimal string. Can be prefixed with '0x' or unprefixed.
     *                      Must decode to exactly 32 bytes for address derivation.
     *
     * @returns A new ExtendedAddress instance with both keys properly initialized
     *
     * @throws {Error} If tweakedPubKey doesn't decode to exactly 32 bytes
     * @throws {Error} If mldsaPubKey doesn't decode to exactly 32 bytes
     * @throws {Error} If either string contains invalid hexadecimal characters
     *
     * @example
     * ```typescript
     * // With 0x prefix
     * const addr1 = ExtendedAddress.fromStringPair(
     *   '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
     *   '0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210'
     * );
     *
     * // Without 0x prefix
     * const addr2 = ExtendedAddress.fromStringPair(
     *   '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
     *   'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210'
     * );
     * ```
     *
     * @remarks
     * For quantum-resistant applications, ensure the mldsaPubKey parameter is the SHA256 hash
     * of a valid ML-DSA-44 (Level 2) public key. The full ML-DSA public key will be loaded
     * from storage when needed for signature verification.
     *
     * @see {@link fromUint8Array} for binary initialization with concatenated keys
     */
    public static fromStringPair(tweakedPubKey: string, mldsaPubKey: string): ExtendedAddress {
        if (tweakedPubKey.startsWith('0x')) {
            tweakedPubKey = tweakedPubKey.slice(2);
        }

        if (mldsaPubKey.startsWith('0x')) {
            mldsaPubKey = mldsaPubKey.slice(2);
        }

        return new ExtendedAddress(decodeHexArray(tweakedPubKey), decodeHexArray(mldsaPubKey));
    }

    /**
     * Creates an ExtendedAddress from a concatenated 64-byte array.
     *
     * The input must contain exactly 64 bytes: the first 32 bytes are the tweaked
     * Schnorr public key, followed by 32 bytes of the ML-DSA public key hash.
     *
     * @param bytes - A 64-byte Uint8Array containing both keys concatenated
     *
     * @returns A new ExtendedAddress instance
     *
     * @throws {Error} If the input is not exactly 64 bytes
     *
     * @example
     * ```typescript
     * const combined = new Uint8Array(64);
     * combined.set(tweakedKey, 0);
     * combined.set(mldsaKeyHash, 32);
     * const addr = ExtendedAddress.fromUint8Array(combined);
     * ```
     */
    public static override fromUint8Array(bytes: Uint8Array): ExtendedAddress {
        if (bytes.length !== 64) {
            throw new Error('Expected 64 bytes: 32 for tweakedPublicKey, 32 for publicKey');
        }

        const tweakedPublicKey: u8[] = new Array<u8>(32);
        const publicKey: u8[] = new Array<u8>(32);

        for (let i = 0; i < 32; i++) {
            tweakedPublicKey[i] = bytes[i];
            publicKey[i] = bytes[32 + i];
        }

        return new ExtendedAddress(tweakedPublicKey, publicKey);
    }

    /**
     * Generates a CSV (CheckSequenceVerify) timelocked P2WSH address.
     *
     * Creates a Bitcoin address that requires both the specified number of blocks
     * to pass and the correct signature to spend funds. Used for timelocked
     * liquidity provisions in NativeSwap and similar protocols.
     *
     * @param address - The address bytes to create CSV lock for
     * @param blocks - Number of blocks for the CSV timelock
     *
     * @returns The generated P2WSH address string with CSV timelock
     *
     * @example
     * ```typescript
     * // Create 144-block (approximately 1 day) timelock
     * const timelocked = ExtendedAddress.toCSV(addr.toBytes(), 144);
     * ```
     */
    public static toCSV(address: Uint8Array, blocks: u32): string {
        return BitcoinAddresses.csvP2wshAddress(address, blocks, Network.hrp(Blockchain.network))
            .address;
    }

    /**
     * Generates a P2WPKH (pay-to-witness-public-key-hash) address.
     *
     * Creates a native SegWit address (bc1...) from the provided address bytes.
     * This is the standard Bitcoin address format for SegWit transactions.
     *
     * @param address - The address bytes to encode
     *
     * @returns The bech32-encoded P2WPKH address string
     *
     * @example
     * ```typescript
     * const segwitAddr = ExtendedAddress.p2wpkh(addr.toBytes());
     * // Returns: "bc1q..." on mainnet or "tb1q..." on testnet
     * ```
     */
    public static p2wpkh(address: Uint8Array): string {
        return BitcoinAddresses.p2wpkh(address, Network.hrp(Blockchain.network));
    }

    /**
     * Downcasts this ExtendedAddress to a base Address.
     *
     * Returns this instance as the base Address type, maintaining only
     * the ML-DSA public key hash and losing access to the tweaked key.
     *
     * @returns This instance cast as Address
     *
     * @remarks
     * The returned Address still contains the same data but without
     * access to ExtendedAddress-specific methods and the tweaked key.
     */
    public downCast(): Address {
        return this;
    }

    /**
     * Checks if all bytes of the ML-DSA key hash are zero.
     *
     * @returns `true` if the ML-DSA key hash is all zeros, `false` otherwise
     *
     * @remarks
     * This only checks the ML-DSA key hash portion (inherited from Address),
     * not the tweaked Schnorr key. Use ZERO_BITCOIN_ADDRESS for a fully
     * zero ExtendedAddress.
     */
    public override isZero(): bool {
        for (let i = 0; i < this.length; i++) {
            if (this[i] != 0) {
                return false;
            }
        }

        return true;
    }

    /**
     * Checks if this address equals the canonical dead address.
     *
     * @returns `true` if this address matches the dead address, `false` otherwise
     *
     * @example
     * ```typescript
     * if (recipient.isDead()) {
     *   // Funds are being burned
     *   return;
     * }
     * ```
     */
    public isDead(): bool {
        // Use cached dead address for comparison
        const deadAddr = ExtendedAddress.dead();

        // Compare both ML-DSA key hash (this) and tweaked key
        for (let i = 0; i < this.length; i++) {
            if (this[i] != deadAddr[i]) {
                return false;
            }
        }

        for (let i = 0; i < this.tweakedPublicKey.length; i++) {
            if (this.tweakedPublicKey[i] != deadAddr.tweakedPublicKey[i]) {
                return false;
            }
        }
        return true;
    }

    /**
     * Generates the P2TR (pay-to-taproot) address for this ExtendedAddress.
     *
     * Uses the tweaked Schnorr public key to create a taproot address
     * following BIP341 specifications. This is the primary Bitcoin address
     * format for this ExtendedAddress.
     *
     * @returns The bech32m-encoded P2TR address string
     *
     * @example
     * ```typescript
     * const taprootAddr = addr.p2tr();
     * // Returns: "bc1p..." on mainnet or "tb1p..." on testnet
     * ```
     *
     * @remarks
     * The address is generated from the tweaked public key only.
     * The ML-DSA key hash is not used in P2TR address generation.
     */
    public p2tr(): string {
        return BitcoinAddresses.p2trKeyPathAddress(
            this.tweakedPublicKey,
            Network.hrp(Blockchain.network),
        );
    }

    /**
     * Returns the P2TR address string representation.
     *
     * @returns The P2TR address (delegates to p2tr())
     *
     * @override Overrides the base Address.toString() which returns hex
     */
    public override toString(): string {
        return this.p2tr();
    }

    /**
     * Creates a deep copy of this ExtendedAddress.
     *
     * @returns A new ExtendedAddress instance with identical data
     *
     * @override Overrides Address.clone() to return ExtendedAddress type
     *
     * @remarks
     * Both the tweaked Schnorr key and ML-DSA key hash are cloned.
     * The isDefined flag state is also preserved in the clone.
     */
    public override clone(): ExtendedAddress {
        // Convert Uint8Array to u8[] for the tweakedPublicKey
        const tweakedKeyArray: u8[] = new Array<u8>(this.tweakedPublicKey.length);
        for (let i = 0; i < this.tweakedPublicKey.length; i++) {
            tweakedKeyArray[i] = this.tweakedPublicKey[i];
        }

        // Convert the address bytes (this.slice(0)) to u8[]
        const addressSlice = this.slice(0);
        const addressArray: u8[] = new Array<u8>(addressSlice.length);
        for (let i = 0; i < addressSlice.length; i++) {
            addressArray[i] = addressSlice[i];
        }

        const cloned = new ExtendedAddress(tweakedKeyArray, addressArray);

        // Duplicate the isDefined flag as well:
        cloned.isDefined = this.isDefined;

        return cloned;
    }
}

/**
 * Pre-initialized zero ExtendedAddress constant.
 * Both the tweaked key and ML-DSA key hash are all zeros.
 */
export const ZERO_BITCOIN_ADDRESS: ExtendedAddress = new ExtendedAddress(ZERO_ARRAY, ZERO_ARRAY);

/**
 * Pre-initialized dead ExtendedAddress constant.
 * The tweaked key is zero while the ML-DSA key hash represents the canonical dead address.
 * Hash: 284ae4acdb32a99ba3ebfa66a91ddb41a7b7a1d2fef415399922cd8a04485c02
 */
export const DEAD_ADDRESS: ExtendedAddress = new ExtendedAddress(DEAD_ARRAY, ZERO_ARRAY);

/**
 * Type alias for nullable ExtendedAddress references.
 */
export declare type PotentialBitcoinAddress = Potential<ExtendedAddress>;
