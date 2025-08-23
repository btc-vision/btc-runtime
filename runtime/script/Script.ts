import { BytesWriter } from '../buffer/BytesWriter';
import { BitcoinOpcodes } from './Opcodes';
import { ScriptReader } from './reader/ScriptReader';
import { CsvRecognize, MultisigRecognize } from './ScriptUtils';
import { Revert } from '../types/Revert';

/**
 * ScriptNumber handles Bitcoin Script's unique number encoding format
 * Bitcoin uses a variable-length, little-endian encoding with a sign bit
 */
@final
export class ScriptNumber {
    /**
     * Calculate how many bytes are needed to encode a number
     * in Bitcoin Script format
     */
    public static encodedLen(x: i64): i32 {
        if (x == 0) return 0;

        // Work with absolute value to count bytes
        let n = x < 0 ? -x : x;
        let bytes = 0;

        while (n > 0) {
            bytes++;
            n >>= 8;
        }

        // Check if we need an extra byte for the sign bit
        // This happens when the most significant bit is already set
        const msb: u8 = <u8>(((x < 0 ? -x : x) >> (<i64>((bytes - 1) * 8))) & 0xff);
        return (msb & 0x80) != 0 ? bytes + 1 : bytes;
    }

    /**
     * Encode a number into Bitcoin Script format
     * Returns a little-endian byte array with sign in the MSB
     */
    public static encode(x: i64): Uint8Array {
        const L = ScriptNumber.encodedLen(x);
        if (L == 0) return new Uint8Array(0);

        const neg = x < 0;
        let n = neg ? -x : x;
        const out = new Uint8Array(L);

        // Write bytes in little-endian order
        for (let i = 0; i < L; i++) {
            out[i] = <u8>(n & 0xff);
            n >>= 8;
        }

        // Handle sign bit
        if (neg) {
            out[L - 1] |= 0x80;
        } else if ((out[L - 1] & 0x80) != 0) {
            // If MSB is set on a positive number, we need an extra byte
            out[L - 1] = 0x00;
        }

        return out;
    }

    /**
     * Decode result type for safe error handling
     */
    public static decodeResult(data: Uint8Array, minimal: bool = true): DecodeNumberResult {
        const L = data.length;
        if (L == 0) return DecodeNumberResult.ok(0);

        // Script numbers are limited to 4 bytes
        if (L > 4) return DecodeNumberResult.err('ScriptNumber too large');

        // Check minimal encoding if required
        if (minimal) {
            const msb = data[L - 1];
            if ((msb & 0x7f) == 0) {
                if (L == 1) return DecodeNumberResult.err('non-minimal zero');
                if ((data[L - 2] & 0x80) == 0) {
                    return DecodeNumberResult.err('non-minimal sign byte');
                }
            }
        }

        // Decode the number
        let res: i64 = 0;
        for (let i = 0; i < L; i++) {
            res |= (<i64>((<i64>data[i]) & 0xff)) << (<i64>8 * i);
        }

        // Handle negative numbers
        const neg = (data[L - 1] & 0x80) != 0;
        if (neg) {
            // Clear the sign bit and negate
            const mask: i64 = ~((<i64>0x80) << (<i64>8 * (L - 1)));
            res &= mask;
            res = -res;
        }

        return DecodeNumberResult.ok(res);
    }

    /**
     * Consider using decodeResult for safe decoding
     * This method will throw an error if decoding fails
     */
    public static decode(data: Uint8Array, minimal: bool = true): i64 {
        const result = ScriptNumber.decodeResult(data, minimal);
        if (!result.success) {
            if (!result.error) {
                throw new Revert('Unexpected error in ScriptNumber.decode');
            }

            throw new Revert(result.error);
        }
        return result.value;
    }
}

/**
 * Result type for number decoding operations
 */
@final
export class DecodeNumberResult {
    public readonly success: bool;
    public readonly value: i64;
    public readonly error: string | null;

    public constructor(success: bool, value: i64, error: string | null) {
        this.success = success;
        this.value = value;
        this.error = error;
    }

    static ok(value: i64): DecodeNumberResult {
        return new DecodeNumberResult(true, value, null);
    }

    static err(error: string): DecodeNumberResult {
        return new DecodeNumberResult(false, 0, error);
    }
}

/**
 * ScriptIO handles the serialization of Script operations
 * It knows how to write push operations in the most efficient format
 */
@final
export class ScriptIO {
    /**
     * Calculate the size needed for a push operation
     * This includes the opcode and any length prefixes
     */
    public static pushPrefixSize(len: i32): i32 {
        if (len == 0) return 1; // OP_0
        if (len <= 75) return 1; // Direct push
        if (len < 0x100) return 2; // OP_PUSHDATA1 + 1 byte length
        if (len < 0x10000) return 3; // OP_PUSHDATA2 + 2 byte length
        return 5; // OP_PUSHDATA4 + 4 byte length
    }

    /**
     * Write a push operation in the most efficient format
     * Bitcoin Script has several ways to push data onto the stack
     */
    public static writePush(w: BytesWriter, data: Uint8Array): void {
        const len = data.length;

        if (len == 0) {
            // Empty pushes use OP_0
            w.writeU8(BitcoinOpcodes.OP_0);
            return;
        }

        if (len <= 75) {
            // Small pushes: the length itself is the opcode
            w.writeU8(<u8>len);
            w.writeBytes(data);
            return;
        }

        if (len < 0x100) {
            // Medium pushes: OP_PUSHDATA1 followed by 1-byte length
            w.writeU8(BitcoinOpcodes.OP_PUSHDATA1);
            w.writeU8(<u8>len);
            w.writeBytes(data);
            return;
        }

        if (len < 0x10000) {
            // Large pushes: OP_PUSHDATA2 followed by 2-byte length
            w.writeU8(BitcoinOpcodes.OP_PUSHDATA2);
            w.writeU8(<u8>len);
            w.writeU8(<u8>(len >>> 8));
            w.writeBytes(data);
            return;
        }

        // Very large pushes: OP_PUSHDATA4 followed by 4-byte length
        w.writeU8(BitcoinOpcodes.OP_PUSHDATA4);
        w.writeU8(<u8>len);
        w.writeU8(<u8>(len >>> 8));
        w.writeU8(<u8>(len >>> 16));
        w.writeU8(<u8>(len >>> 24));
        w.writeBytes(data);
    }
}

@final
export class BitcoinScript {
    /**
     * Create a CSV (CheckSequenceVerify) timelock script
     * This allows coins to be locked for a certain number of blocks
     */
    public static csvTimelock(pubkey: Uint8Array, csvBlocks: i32): Uint8Array {
        // Validate inputs
        if (csvBlocks < 0) throw new Revert('csvBlocks must be >= 0');
        if (csvBlocks > 65535) throw new Revert('csvBlocks exceeds 16-bit BIP-68 field');

        const pubLen = pubkey.length;

        // Calculate size needed for the number part
        let nPartSize = 0;
        if (csvBlocks == 0) {
            nPartSize = 1; // OP_0
        } else if (csvBlocks <= 16) {
            nPartSize = 1; // OP_1 through OP_16
        } else {
            // Need to encode as a push operation
            const nBytes = ScriptNumber.encodedLen(csvBlocks);
            nPartSize = ScriptIO.pushPrefixSize(nBytes) + nBytes;
        }

        // Calculate total script size
        const sz =
            nPartSize +
            1 + // OP_CHECKSEQUENCEVERIFY
            1 + // OP_DROP
            ScriptIO.pushPrefixSize(pubLen) +
            pubLen + // pubkey push
            1; // OP_CHECKSIG

        if (sz > 10000) throw new Revert('script too large');

        // Build the script
        const w = new BytesWriter(sz);

        // Write the CSV blocks value
        if (csvBlocks == 0) {
            w.writeU8(BitcoinOpcodes.OP_0);
        } else if (csvBlocks <= 16) {
            w.writeU8(BitcoinOpcodes.opN(csvBlocks));
        } else {
            const enc = ScriptNumber.encode(csvBlocks);
            ScriptIO.writePush(w, enc);
        }

        // Write the rest of the script
        w.writeU8(BitcoinOpcodes.OP_CHECKSEQUENCEVERIFY);
        w.writeU8(BitcoinOpcodes.OP_DROP);
        ScriptIO.writePush(w, pubkey);
        w.writeU8(BitcoinOpcodes.OP_CHECKSIG);

        return w.getBuffer().subarray(0, <i32>w.getOffset());
    }

    /**
     * Create a multisig script
     * Requires m-of-n signatures to spend
     */
    public static multisig(m: i32, pubkeys: Array<Uint8Array>): Uint8Array {
        const n = pubkeys.length;

        // Validate parameters
        if (m < 1 || m > 16) throw new Revert('m out of range');
        if (n < m || n > 16) throw new Revert('n out of range');

        // Calculate total size
        let sz = 1; // OP_m
        for (let i = 0; i < n; i++) {
            const L = pubkeys[i].length;
            sz += ScriptIO.pushPrefixSize(L) + L;
        }
        sz += 1 + 1; // OP_n + OP_CHECKMULTISIG

        if (sz > 10000) throw new Revert('script too large');

        // Build the script
        const w = new BytesWriter(sz);
        w.writeU8(BitcoinOpcodes.opN(m));

        for (let i = 0; i < n; i++) {
            ScriptIO.writePush(w, pubkeys[i]);
        }

        w.writeU8(BitcoinOpcodes.opN(n));
        w.writeU8(BitcoinOpcodes.OP_CHECKMULTISIG);

        return w.getBuffer().subarray(0, <i32>w.getOffset());
    }

    /**
     * Recognize and parse a CSV timelock script
     * Returns the CSV blocks and pubkey if the script matches the pattern
     */
    public static recognizeCsvTimelock(
        script: Uint8Array,
        strictMinimal: bool = true,
    ): CsvRecognize {
        const r = new ScriptReader(script);

        if (r.done()) return new CsvRecognize(false, -1, null);

        // Read the CSV blocks value
        let result = r.nextSafe(strictMinimal);
        if (!result.success) return new CsvRecognize(false, -1, null);

        let t = result.value!;
        let csvBlocks: i64 = -1;
        let pubkey: Uint8Array | null = null;

        // Parse the number from the first instruction
        if (t.data !== null) {
            // It's a push operation - decode the number
            const numResult = ScriptNumber.decodeResult(t.data as Uint8Array, strictMinimal);
            if (!numResult.success || numResult.value < 0) {
                return new CsvRecognize(false, -1, null);
            }
            csvBlocks = numResult.value;
        } else {
            // It's a direct opcode
            const op = t.op;
            if (op == <i32>BitcoinOpcodes.OP_1NEGATE) {
                return new CsvRecognize(false, -1, null);
            }
            if (op >= <i32>BitcoinOpcodes.OP_1 && op <= <i32>BitcoinOpcodes.OP_16) {
                csvBlocks = <i64>(op - 0x50);
            } else if (op == <i32>BitcoinOpcodes.OP_0) {
                csvBlocks = 0;
            } else {
                return new CsvRecognize(false, -1, null);
            }
        }

        // Check for OP_CHECKSEQUENCEVERIFY
        if (r.done()) return new CsvRecognize(false, -1, null);
        result = r.nextSafe(strictMinimal);
        if (!result.success) return new CsvRecognize(false, -1, null);
        t = result.value!;
        if (t.op != <i32>BitcoinOpcodes.OP_CHECKSEQUENCEVERIFY) {
            return new CsvRecognize(false, -1, null);
        }

        // Check for OP_DROP
        if (r.done()) return new CsvRecognize(false, -1, null);
        result = r.nextSafe(strictMinimal);
        if (!result.success) return new CsvRecognize(false, -1, null);
        t = result.value!;
        if (t.op != <i32>BitcoinOpcodes.OP_DROP) {
            return new CsvRecognize(false, -1, null);
        }

        // Read the pubkey
        if (r.done()) return new CsvRecognize(false, -1, null);
        result = r.nextSafe(strictMinimal);
        if (!result.success) return new CsvRecognize(false, -1, null);
        t = result.value!;
        if (t.data === null) return new CsvRecognize(false, -1, null);

        const pk = t.data as Uint8Array;
        const Lpk = pk.length;
        // Valid pubkeys are either 33 bytes (compressed) or 65 bytes (uncompressed)
        if (Lpk != 33 && Lpk != 65) return new CsvRecognize(false, -1, null);
        pubkey = pk;

        // Check for OP_CHECKSIG
        if (r.done()) return new CsvRecognize(false, -1, null);
        result = r.nextSafe(strictMinimal);
        if (!result.success) return new CsvRecognize(false, -1, null);
        t = result.value!;
        if (t.op != <i32>BitcoinOpcodes.OP_CHECKSIG) {
            return new CsvRecognize(false, -1, null);
        }

        // Script should be exactly consumed
        if (!r.done()) return new CsvRecognize(false, -1, null);

        return new CsvRecognize(true, csvBlocks, pubkey);
    }

    /**
     * Recognize and parse a multisig script
     * Returns m, n, and the list of pubkeys if the script matches
     */
    public static recognizeMultisig(
        script: Uint8Array,
        strictMinimal: bool = true,
    ): MultisigRecognize {
        const r = new ScriptReader(script);

        if (r.done()) return new MultisigRecognize(false, 0, 0, null);

        // Read m value
        let result = r.nextSafe(strictMinimal);
        if (!result.success) return new MultisigRecognize(false, 0, 0, null);

        let t = result.value!;
        const opm = t.op;
        if (opm < <i32>BitcoinOpcodes.OP_1 || opm > <i32>BitcoinOpcodes.OP_16) {
            return new MultisigRecognize(false, 0, 0, null);
        }
        const m = opm - 0x50;

        // Collect pubkeys
        const keys = new Array<Uint8Array>();

        while (!r.done()) {
            result = r.nextSafe(strictMinimal);
            if (!result.success) return new MultisigRecognize(false, 0, 0, null);
            t = result.value!;

            if (t.data !== null) {
                // This is a pubkey
                const pk = t.data as Uint8Array;
                const L = pk.length;
                if (L != 33 && L != 65) {
                    return new MultisigRecognize(false, 0, 0, null);
                }
                keys.push(pk);
                continue;
            }

            // Must be the n value
            if (t.op < <i32>BitcoinOpcodes.OP_1 || t.op > <i32>BitcoinOpcodes.OP_16) {
                return new MultisigRecognize(false, 0, 0, null);
            }
            const n = t.op - 0x50;

            // Validate n
            if (n != keys.length || n < m) {
                return new MultisigRecognize(false, 0, 0, null);
            }

            // Next must be OP_CHECKMULTISIG
            if (r.done()) return new MultisigRecognize(false, 0, 0, null);

            const result2 = r.nextSafe(strictMinimal);
            if (!result2.success) return new MultisigRecognize(false, 0, 0, null);
            const t2 = result2.value!;

            if (t2.op != <i32>BitcoinOpcodes.OP_CHECKMULTISIG) {
                return new MultisigRecognize(false, 0, 0, null);
            }

            // Script should be fully consumed
            if (!r.done()) return new MultisigRecognize(false, 0, 0, null);

            return new MultisigRecognize(true, m, n, keys);
        }

        return new MultisigRecognize(false, 0, 0, null);
    }
}
