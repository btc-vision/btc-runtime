import { BitcoinAddresses, Ct } from './BitcoinAddresses';
import { BytesWriter } from '../buffer/BytesWriter';
import { BytesReader } from '../buffer/BytesReader';
import { CsvPairCrossCheck, MultisigPairCrossCheck } from './ScriptUtils';
import { Segwit } from './Segwit';
import { sha256 } from '../env/global';
import { BitcoinScript } from './Script';
import { Revert } from '../types/Revert';

/**
 * Result type for codec operations that can fail
 * This provides detailed error information when operations fail
 */
@final
export class CodecResult<T> {
    public readonly success: bool;
    public readonly value: T | null;
    public readonly error: string | null;

    public constructor(success: bool, value: T | null, error: string | null) {
        this.success = success;
        this.value = value;
        this.error = error;
    }

    public static ok<T>(value: T): CodecResult<T> {
        return new CodecResult<T>(true, value, null);
    }

    public static err<T>(error: string): CodecResult<T> {
        return new CodecResult<T>(false, null, error);
    }
}

/**
 * Represents a verified address read from a byte stream
 */
@final
export class VerifiedAddress {
    public readonly address: string;
    public readonly witnessScript: Uint8Array | null;

    constructor(address: string, witnessScript: Uint8Array | null = null) {
        this.address = address;
        this.witnessScript = witnessScript;
    }
}

/**
 * BitcoinCodec provides serialization and deserialization functions for
 * various Bitcoin address types and witness scripts. All methods use
 * explicit error handling suitable for AssemblyScript/WebAssembly.
 */
@final
export class BitcoinCodec {
    /**
     * Write a CSV P2WSH address and witness script to a byte stream
     *
     * @param out - The output writer to write to
     * @param pubkey - The public key for the CSV timelock
     * @param csvBlocks - Number of blocks for the timelock
     * @param hrp - Human-readable part for the address
     */
    public static writeCsvP2wsh(
        out: BytesWriter,
        pubkey: Uint8Array,
        csvBlocks: i32,
        hrp: string,
    ): void {
        const res = BitcoinAddresses.csvP2wshAddress(pubkey, csvBlocks, hrp);
        out.writeStringWithLength(res.address);
        out.writeBytesWithLength(res.witnessScript);
    }

    /**
     * Read a CSV P2WSH address and verify it matches expected parameters
     *
     * @param inp - The input reader to read from
     * @param pubkey - The expected public key
     * @param csvBlocks - The expected CSV blocks
     * @param hrp - The expected human-readable part
     * @param strictMinimal - Whether to enforce strict minimal encoding
     * @returns A result containing the verified address or an error
     */
    public static readAndVerifyCsvP2wsh(
        inp: BytesReader,
        pubkey: Uint8Array,
        csvBlocks: i32,
        hrp: string,
        strictMinimal: bool = true,
    ): CodecResult<VerifiedAddress> {
        const addr = inp.readStringWithLength();

        if (BitcoinAddresses.verifyCsvP2wshAddress(pubkey, csvBlocks, addr, hrp, strictMinimal)) {
            const ws = BitcoinAddresses.csvWitnessScript(pubkey, csvBlocks);
            return CodecResult.ok<VerifiedAddress>(new VerifiedAddress(addr, ws));
        }

        return CodecResult.err<VerifiedAddress>(
            'CSV P2WSH verification failed: address does not match expected parameters',
        );
    }

    /**
     * Write a multisig P2WSH address and witness script to a byte stream
     *
     * @param out - The output writer
     * @param m - Number of required signatures
     * @param pubkeys - Array of public keys
     * @param hrp - Human-readable part for the address
     */
    public static writeMultisigP2wsh(
        out: BytesWriter,
        m: i32,
        pubkeys: Array<Uint8Array>,
        hrp: string,
    ): void {
        const res = BitcoinAddresses.multisigP2wshAddress(m, pubkeys, hrp);
        out.writeStringWithLength(res.address);
        out.writeBytesWithLength(res.witnessScript);
    }

    /**
     * Read and verify a multisig P2WSH address
     *
     * @param inp - The input reader
     * @param m - Expected number of required signatures
     * @param pubkeys - Expected array of public keys
     * @param hrp - Expected human-readable part
     * @returns A result containing the verified address or an error
     */
    public static readAndVerifyMultisigP2wsh(
        inp: BytesReader,
        m: i32,
        pubkeys: Array<Uint8Array>,
        hrp: string,
    ): CodecResult<VerifiedAddress> {
        const addr = inp.readStringWithLength();

        if (BitcoinAddresses.verifyMultisigP2wshAddress(m, pubkeys, addr, hrp)) {
            const ws = BitcoinAddresses.multisigWitnessScript(m, pubkeys);
            return CodecResult.ok<VerifiedAddress>(new VerifiedAddress(addr, ws));
        }

        return CodecResult.err<VerifiedAddress>(
            'Multisig P2WSH verification failed: address does not match expected parameters',
        );
    }

    /**
     * Write a Taproot address to a byte stream
     *
     * @param out - The output writer
     * @param outputKeyX32 - The 32-byte X coordinate of the output key
     * @param hrp - Human-readable part for the address
     */
    public static writeP2tr(out: BytesWriter, outputKeyX32: Uint8Array, hrp: string): void {
        const addr = BitcoinAddresses.p2trKeyPathAddress(outputKeyX32, hrp);
        out.writeStringWithLength(addr);
    }

    /**
     * Read and verify a Taproot address
     *
     * @param inp - The input reader
     * @param outputKeyX32 - Expected 32-byte X coordinate
     * @param hrp - Expected human-readable part
     * @returns A result containing the verified address or an error
     */
    public static readAndVerifyP2tr(
        inp: BytesReader,
        outputKeyX32: Uint8Array,
        hrp: string,
    ): CodecResult<VerifiedAddress> {
        const addr = inp.readStringWithLength();

        if (BitcoinAddresses.verifyP2trAddress(outputKeyX32, addr, hrp)) {
            return CodecResult.ok<VerifiedAddress>(new VerifiedAddress(addr));
        }

        return CodecResult.err<VerifiedAddress>(
            'P2TR verification failed: address does not match expected output key',
        );
    }

    /**
     * Read a P2WSH address/witness script pair and verify they match
     *
     * @param inp - The input reader
     * @param hrp - Expected human-readable part
     * @returns A result containing verification details
     */
    public static readP2wshPairAndVerify(
        inp: BytesReader,
        hrp: string,
    ): CodecResult<VerifiedAddress> {
        const address = inp.readStringWithLength();
        const witnessScript = inp.readBytesWithLength();

        // Decode the address
        const dec = Segwit.decodeOrNull(address);
        if (!dec) {
            return CodecResult.err<VerifiedAddress>('Failed to decode address');
        }

        // Verify it's a valid P2WSH address
        if (dec.version != 0) {
            return CodecResult.err<VerifiedAddress>('Invalid witness version: expected v0');
        }

        if (dec.hrp != hrp) {
            return CodecResult.err<VerifiedAddress>(
                `HRP mismatch: expected ${hrp}, got ${dec.hrp}`,
            );
        }

        if (dec.program.length != 32) {
            return CodecResult.err<VerifiedAddress>(
                'Invalid program length: P2WSH must be 32 bytes',
            );
        }

        // Verify the witness script hashes to the witness program
        const prog = sha256(witnessScript);
        if (!Ct.eq32(dec.program, prog)) {
            return CodecResult.err<VerifiedAddress>('Witness script hash mismatch');
        }

        return CodecResult.ok<VerifiedAddress>(new VerifiedAddress(address, witnessScript));
    }

    /**
     * Read a CSV P2WSH pair and cross-check all components
     *
     * @param inp - The input reader
     * @param hrp - Expected human-readable part
     * @param strictMinimal - Whether to enforce strict minimal encoding
     * @returns Detailed cross-check results including extracted parameters
     */
    public static readCsvP2wshPairAndCrossCheck(
        inp: BytesReader,
        hrp: string,
        strictMinimal: bool = true,
    ): CsvPairCrossCheck {
        const address = inp.readStringWithLength();
        const witnessScript = inp.readBytesWithLength();

        // Decode the address
        const dec = Segwit.decodeOrNull(address);
        if (!dec) {
            return new CsvPairCrossCheck(false, address, witnessScript, -1, null);
        }

        // Verify it's a valid P2WSH address
        if (dec.version != 0 || dec.hrp != hrp || dec.program.length != 32) {
            return new CsvPairCrossCheck(false, address, witnessScript, -1, null);
        }

        // Verify the witness script hashes to the witness program
        const prog = sha256(witnessScript);
        if (!Ct.eq32(dec.program, prog)) {
            return new CsvPairCrossCheck(false, address, witnessScript, -1, null);
        }

        // Parse the witness script to extract CSV parameters
        const rec = BitcoinScript.recognizeCsvTimelock(witnessScript, strictMinimal);
        if (!rec.ok) {
            return new CsvPairCrossCheck(false, address, witnessScript, -1, null);
        }

        // Everything checks out
        return new CsvPairCrossCheck(true, address, witnessScript, rec.csvBlocks, rec.pubkey);
    }

    /**
     * Read a multisig P2WSH pair and cross-check all components
     *
     * @param inp - The input reader
     * @param hrp - Expected human-readable part
     * @param expectedM - Optional: verify the m value matches
     * @param expectedPubkeys - Optional: verify the public keys match
     * @param strictMinimal - Whether to enforce strict minimal encoding
     * @returns Detailed cross-check results
     */
    public static readMultisigP2wshPairAndCrossCheck(
        inp: BytesReader,
        hrp: string,
        expectedM: i32 = -1,
        expectedPubkeys: Array<Uint8Array> | null = null,
        strictMinimal: bool = true,
    ): MultisigPairCrossCheck {
        const address = inp.readStringWithLength();
        const witnessScript = inp.readBytesWithLength();

        // Decode the address
        const dec = Segwit.decodeOrNull(address);
        if (!dec) {
            return new MultisigPairCrossCheck(false, 0, 0, address);
        }

        // Verify it's a valid P2WSH address
        if (dec.version != 0 || dec.hrp != hrp || dec.program.length != 32) {
            return new MultisigPairCrossCheck(false, 0, 0, address);
        }

        // Verify the witness script hashes to the witness program
        const prog = sha256(witnessScript);
        if (!Ct.eq32(dec.program, prog)) {
            return new MultisigPairCrossCheck(false, 0, 0, address);
        }

        // Parse the witness script to extract multisig parameters
        const rec = BitcoinScript.recognizeMultisig(witnessScript, strictMinimal);
        if (!rec.ok) {
            return new MultisigPairCrossCheck(false, 0, 0, address);
        }

        // Check if m matches expected value (if provided)
        if (expectedM >= 0 && rec.m != expectedM) {
            return new MultisigPairCrossCheck(false, rec.m, rec.n, address);
        }

        // Check if public keys match expected values (if provided)
        if (expectedPubkeys !== null) {
            if (!rec.pubkeys) throw new Revert('Public keys not found in multisig script');

            if (!BitcoinCodec.comparePublicKeyArrays(rec.pubkeys, expectedPubkeys)) {
                return new MultisigPairCrossCheck(false, rec.m, rec.n, address);
            }
        }

        // All checks passed
        return new MultisigPairCrossCheck(true, rec.m, rec.n, address);
    }

    /**
     * Write a generic witness script and its address
     *
     * @param out - The output writer
     * @param witnessScript - The witness script bytes
     * @param hrp - Human-readable part for the address
     */
    public static writeWitnessScriptAndAddress(
        out: BytesWriter,
        witnessScript: Uint8Array,
        hrp: string,
    ): void {
        const address = Segwit.p2wsh(hrp, witnessScript);
        out.writeStringWithLength(address);
        out.writeBytesWithLength(witnessScript);
    }

    /**
     * Validate that a witness script is within size limits
     * Bitcoin consensus rules limit witness scripts to 10,000 bytes
     * Witness scripts above 3,600 bytes are non-standard and will not be relayed
     *
     * @param witnessScript - The script to validate
     * @returns true if the script is within limits
     */
    public static isValidWitnessScriptSize(witnessScript: Uint8Array): bool {
        return witnessScript.length <= 10000;
    }

    /**
     * Compare two arrays of public keys for equality
     * Uses constant-time comparison for each key
     *
     * @param a - First array of public keys
     * @param b - Second array of public keys
     * @returns true if arrays are identical
     */
    private static comparePublicKeyArrays(a: Array<Uint8Array>, b: Array<Uint8Array>): bool {
        // Check array lengths first
        if (a.length != b.length) return false;

        // Compare each key
        for (let i = 0; i < a.length; i++) {
            const keyA = a[i];
            const keyB = b[i];

            // Check key lengths
            if (keyA.length != keyB.length) return false;

            // Constant-time byte comparison
            let diff = 0;
            for (let j = 0; j < keyA.length; j++) {
                diff |= keyA[j] ^ keyB[j];
            }

            if (diff != 0) return false;
        }

        return true;
    }
}
