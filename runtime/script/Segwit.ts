import { SegwitDecoded } from './ScriptUtils';
import { hash160, sha256 } from '../env/global';
import { Bech32 } from './Bech32';
import { Revert } from '../types/Revert';
import { BitcoinCodec } from './BitcoinCodec';

/**
 * Segwit provides high-level functions for creating and decoding
 * Segregated Witness (SegWit) addresses. These addresses use Bech32
 * encoding and support various witness versions.
 *
 * Witness v0 uses Bech32 encoding, while v1+ uses Bech32m encoding.
 */
@final
export class Segwit {
    /**
     * Create a Pay-to-Witness-Script-Hash (P2WSH) address
     * This is used for scripts that require more complex spending conditions
     *
     * The witness script is hashed with SHA256 and encoded as a v0 witness program
     *
     * @param hrp - Human-readable part (e.g., "bc" for mainnet, "tb" for testnet)
     * @param witnessScript - The script that will control spending
     * @returns The Bech32-encoded address
     */
    public static p2wsh(hrp: string, witnessScript: Uint8Array): string {
        if (!BitcoinCodec.isValidWitnessScriptSize(witnessScript)) {
            throw new Revert(`Witness script size is invalid`);
        }

        // P2WSH uses SHA256 of the script as the witness program
        const program = sha256(witnessScript);
        return Bech32.encode(hrp, 0, program);
    }

    /**
     * Safe version of p2wsh that returns null on error
     * This is useful when you need to handle encoding failures gracefully
     */
    public static p2wshOrNull(hrp: string, witnessScript: Uint8Array): string | null {
        if (!BitcoinCodec.isValidWitnessScriptSize(witnessScript)) {
            throw new Revert('Witness script size is invalid');
        }

        const program = sha256(witnessScript);
        return Bech32.encodeOrNull(hrp, 0, program);
    }

    /**
     * Create a Pay-to-Witness-Public-Key-Hash (P2WPKH) address
     * This is the SegWit equivalent of a standard P2PKH address
     *
     * The public key is hashed with HASH160 (RIPEMD160(SHA256))
     * and encoded as a v0 witness program
     *
     * @param hrp - Human-readable part
     * @param pubkey - The public key (33 bytes compressed or 65 bytes uncompressed)
     * @returns The Bech32-encoded address
     */
    public static p2wpkh(hrp: string, pubkey: Uint8Array): string {
        if (pubkey.length !== 33) {
            throw new Revert('Public key must be 33 bytes');
        }

        // P2WPKH uses HASH160 of the public key as the witness program
        const program = hash160(pubkey);
        return Bech32.encode(hrp, 0, program);
    }

    /**
     * Safe version of p2wpkh that returns null on error
     */
    public static p2wpkhOrNull(hrp: string, pubkey: Uint8Array): string | null {
        const program = hash160(pubkey);
        return Bech32.encodeOrNull(hrp, 0, program);
    }

    /**
     * Create a Pay-to-Taproot (P2TR) address
     * This is used for Taproot outputs which support both key-path
     * and script-path spending
     *
     * Taproot addresses use witness version 1 and Bech32m encoding
     *
     * @param hrp - Human-readable part
     * @param outputKeyX32 - The 32-byte X coordinate of the taproot output key
     * @returns The Bech32m-encoded address
     */
    public static p2tr(hrp: string, outputKeyX32: Uint8Array): string {
        // Validate the key length
        if (outputKeyX32.length != 32) {
            throw new Revert('taproot key must be 32 bytes');
        }

        // P2TR uses witness version 1 with the x-only public key
        return Bech32.encode(hrp, 1, outputKeyX32);
    }

    /**
     * Safe version of p2tr that returns null on error
     *
     * @param hrp - Human-readable part
     * @param outputKeyX32 - The 32-byte X coordinate of the taproot output key
     * @returns The Bech32m-encoded address or null if encoding fails
     */
    public static p2trOrNull(hrp: string, outputKeyX32: Uint8Array): string | null {
        // Validate the key length
        if (outputKeyX32.length != 32) return null;

        // P2TR uses witness version 1 with the x-only public key
        return Bech32.encodeOrNull(hrp, 1, outputKeyX32);
    }

    /**
     * Consider using decodeOrNull for safe decoding
     * This method will throw an error if the address is invalid
     *
     * @param address - The Bech32/Bech32m encoded address
     * @returns Decoded address information
     */
    public static decode(address: string): SegwitDecoded {
        return Bech32.decode(address);
    }

    /**
     * Safely decode a SegWit address without throwing/aborting
     * This is the preferred method for AssemblyScript code
     *
     * @param address - The Bech32/Bech32m encoded address
     * @returns Decoded address information or null if invalid
     */
    public static decodeOrNull(address: string): SegwitDecoded | null {
        return Bech32.decodeOrNull(address);
    }

    /**
     * Validate a SegWit address without fully decoding it
     * This is more efficient if you just need to check validity
     *
     * @param address - The address to validate
     * @param expectedHrp - Optional: verify the HRP matches
     * @param expectedVersion - Optional: verify the witness version matches
     * @returns true if the address is valid
     */
    public static isValidAddress(
        address: string,
        expectedHrp: string | null = null,
        expectedVersion: i32 = -1,
    ): bool {
        const decoded = Segwit.decodeOrNull(address);
        if (!decoded) return false;

        // Check HRP if specified
        if (expectedHrp !== null && decoded.hrp != expectedHrp) {
            return false;
        }

        // Check version if specified
        if (expectedVersion >= 0 && decoded.version != expectedVersion) {
            return false;
        }

        // Additional validation based on witness version
        if (decoded.version == 0) {
            // v0 must be 20 bytes (P2WPKH) or 32 bytes (P2WSH)
            const len = decoded.program.length;
            return len == 20 || len == 32;
        } else if (decoded.version >= 1 && decoded.version <= 16) {
            // v1-16 must be 2-40 bytes
            const len = decoded.program.length;
            return len >= 2 && len <= 40;
        }

        // Unknown versions are invalid
        return false;
    }

    /**
     * Extract the script type from a decoded SegWit address
     * This helps identify whether it's P2WPKH, P2WSH, P2TR, etc.
     *
     * @param decoded - The decoded address information
     * @returns A string identifying the script type, or null if unknown
     */
    public static getScriptType(decoded: SegwitDecoded): string | null {
        if (decoded.version == 0) {
            if (decoded.program.length == 20) return 'p2wpkh';
            if (decoded.program.length == 32) return 'p2wsh';
        } else if (decoded.version == 1 && decoded.program.length == 32) {
            return 'p2tr';
        }
        return null;
    }
}
