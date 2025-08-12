import { CsvP2wshResult, MultisigP2wshResult } from './ScriptUtils';
import { Segwit } from './Segwit';
import { BitcoinScript } from './Script';
import { sha256 } from '../env/global';

/**
 * Ct provides constant-time comparison functions
 * This is important for cryptographic operations to avoid timing attacks
 */
@final
export class Ct {
    /**
     * Compare two 32-byte arrays in constant time
     * Returns true if they are equal, false otherwise
     *
     * The function always takes the same amount of time regardless of where
     * the arrays differ, which prevents timing-based attacks
     */
    @inline public static eq32(a: Uint8Array, b: Uint8Array): bool {
        // XOR the lengths with 32 to detect length mismatches
        let d: i32 = (a.length ^ 32) | (b.length ^ 32);

        // Compare each byte, accumulating differences in d
        for (let i = 0; i < 32; i++) {
            // Handle arrays shorter than 32 bytes by treating missing bytes as 0
            const ai: u8 = i < a.length ? a[i] : 0;
            const bi: u8 = i < b.length ? b[i] : 0;
            // XOR accumulates any differences without early exit
            d |= ai ^ bi;
        }

        // d will be 0 only if all bytes matched
        return d == 0;
    }
}

/**
 * BitcoinAddresses provides high-level functions for creating and verifying
 * various types of Bitcoin addresses, particularly those using witness scripts
 */
@final
export class BitcoinAddresses {
    /**
     * Create a witness script for a CSV (CheckSequenceVerify) timelock
     * This script requires a certain number of blocks to pass before spending
     *
     * @param pubkey - The public key that can spend after the timelock
     * @param csvBlocks - Number of blocks to wait (must be 0-65535)
     * @returns The witness script bytes
     */
    public static csvWitnessScript(pubkey: Uint8Array, csvBlocks: i32): Uint8Array {
        return BitcoinScript.csvTimelock(pubkey, csvBlocks);
    }

    /**
     * Create a P2WSH (Pay to Witness Script Hash) address with CSV timelock
     * This creates both the address and the witness script needed to spend it
     *
     * @param pubkey - The public key that can spend after the timelock
     * @param csvBlocks - Number of blocks to wait
     * @param hrp - Human-readable part for the address (e.g., "bc" for mainnet)
     * @returns Object containing both the address and witness script
     */
    public static csvP2wshAddress(pubkey: Uint8Array, csvBlocks: i32, hrp: string): CsvP2wshResult {
        const ws = BitcoinAddresses.csvWitnessScript(pubkey, csvBlocks);
        const addr = Segwit.p2wsh(hrp, ws);
        return new CsvP2wshResult(addr, ws);
    }

    /**
     * Verify that a given address corresponds to a specific CSV timelock setup
     * This is useful for validating that an address was created with expected parameters
     *
     * @param pubkey - The expected public key
     * @param csvBlocks - The expected number of CSV blocks
     * @param address - The address to verify
     * @param hrp - Expected human-readable part
     * @param strictMinimal - Whether to enforce strict minimal encoding rules
     * @returns true if the address matches the expected parameters
     */
    public static verifyCsvP2wshAddress(
        pubkey: Uint8Array,
        csvBlocks: i32,
        address: string,
        hrp: string,
        strictMinimal: bool = true,
    ): bool {
        // Try to decode the address - this replaces the try-catch block
        const dec = Segwit.decodeOrNull(address);
        if (!dec) return false;

        // Verify it's a v0 witness program with 32-byte hash
        if (dec.version != 0 || dec.hrp != hrp || dec.program.length != 32) return false;

        // Reconstruct the witness script and verify it matches
        const ws = BitcoinAddresses.csvWitnessScript(pubkey, csvBlocks);

        // Parse the witness script to ensure it's well-formed
        const rec = BitcoinScript.recognizeCsvTimelock(ws, strictMinimal);
        if (!rec.ok || rec.csvBlocks != csvBlocks) return false;

        // Compute the script hash and compare with the address program
        const prog = sha256(ws);
        return Ct.eq32(dec.program, prog);
    }

    /**
     * Create a witness script for a multisig setup
     * This creates a script requiring m-of-n signatures to spend
     *
     * @param m - Number of required signatures
     * @param pubkeys - Array of public keys (n total)
     * @returns The witness script bytes
     */
    public static multisigWitnessScript(m: i32, pubkeys: Array<Uint8Array>): Uint8Array {
        return BitcoinScript.multisig(m, pubkeys);
    }

    /**
     * Create a P2WSH multisig address
     * This creates both the address and the witness script for a multisig setup
     *
     * @param m - Number of required signatures
     * @param pubkeys - Array of public keys
     * @param hrp - Human-readable part for the address
     * @returns Object containing both the address and witness script
     */
    public static multisigP2wshAddress(
        m: i32,
        pubkeys: Array<Uint8Array>,
        hrp: string,
    ): MultisigP2wshResult {
        const ws = BitcoinAddresses.multisigWitnessScript(m, pubkeys);
        const addr = Segwit.p2wsh(hrp, ws);
        return new MultisigP2wshResult(addr, ws);
    }

    /**
     * Verify that a given address corresponds to a specific multisig setup
     * This validates that an address was created with the expected m-of-n parameters
     *
     * @param m - Expected number of required signatures
     * @param pubkeys - Expected array of public keys
     * @param address - The address to verify
     * @param hrp - Expected human-readable part
     * @returns true if the address matches the expected parameters
     */
    public static verifyMultisigP2wshAddress(
        m: i32,
        pubkeys: Array<Uint8Array>,
        address: string,
        hrp: string,
    ): bool {
        // Decode the address safely
        const dec = Segwit.decodeOrNull(address);
        if (!dec) return false;

        // Verify it's a v0 witness program with 32-byte hash
        if (dec.version != 0 || dec.hrp != hrp || dec.program.length != 32) return false;

        // Reconstruct the witness script and compare
        const ws = BitcoinAddresses.multisigWitnessScript(m, pubkeys);
        const prog = sha256(ws);
        return Ct.eq32(dec.program, prog);
    }

    /**
     * Create a Taproot (P2TR) key-path spend address
     * This is the simplest form of Taproot address, spendable with a single key
     *
     * @param outputKeyX32 - The 32-byte X coordinate of the output key
     * @param hrp - Human-readable part for the address
     * @returns The Bech32m-encoded address
     */
    public static p2trKeyPathAddress(outputKeyX32: Uint8Array, hrp: string): string {
        return Segwit.p2tr(hrp, outputKeyX32);
    }

    /**
     * Create a Pay-to-Witness-Public-Key-Hash (P2WPKH) address
     * @param pubkey - The public key (33 bytes compressed or 65 bytes uncompressed)
     * @param hrp - Human-readable part (e.g., "bc" for mainnet)
     * @returns The Bech32-encoded address
     */
    public static p2wpkh(pubkey: Uint8Array, hrp: string): string {
        return Segwit.p2wpkh(hrp, pubkey);
    }

    /**
     * Verify that a given address corresponds to a specific Taproot output key
     *
     * @param outputKeyX32 - The expected 32-byte X coordinate
     * @param address - The address to verify
     * @param hrp - Expected human-readable part
     * @returns true if the address matches the expected output key
     */
    public static verifyP2trAddress(outputKeyX32: Uint8Array, address: string, hrp: string): bool {
        // Decode the address safely
        const dec = Segwit.decodeOrNull(address);
        if (!dec) return false;

        // Verify it's a v1 witness program with 32-byte key
        if (dec.version != 1 || dec.hrp != hrp || dec.program.length != 32) return false;

        // Compare the output key
        return Ct.eq32(dec.program, outputKeyX32);
    }
}
