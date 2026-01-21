import { ExtendedAddress } from './ExtendedAddress';

/**
 * Represents a Schnorr signature paired with the signer's ExtendedAddress.
 *
 * This class bundles a 64-byte Schnorr signature with its associated
 * ExtendedAddress (64 bytes), providing a complete signed data structure
 * for Bitcoin Taproot-compatible signatures.
 *
 * @example
 * ```typescript
 * // Reading a Schnorr signature from calldata
 * const sig = calldata.readSchnorrSignature();
 * const signer = sig.address;
 * const signature = sig.signature;
 *
 * // Verify the signature
 * const isValid = Blockchain.verifySignature(signer, signature, messageHash);
 * ```
 */
@final
export class SchnorrSignature {
    /**
     * The signer's ExtendedAddress (64 bytes).
     * Contains both the tweaked Schnorr public key and ML-DSA key hash.
     */
    public readonly address: ExtendedAddress;

    /**
     * The 64-byte Schnorr signature.
     */
    public readonly signature: Uint8Array;

    /**
     * Creates a new SchnorrSignature instance.
     *
     * @param address - The signer's ExtendedAddress
     * @param signature - The 64-byte Schnorr signature
     */
    constructor(address: ExtendedAddress, signature: Uint8Array) {
        this.address = address;
        this.signature = signature;
    }
}
