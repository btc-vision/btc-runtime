import { BytesWriter } from '../buffer/BytesWriter';
import { SegwitDecoded } from './ScriptUtils';
import { Revert } from '../types/Revert';

/**
 * Result type for Bech32 operations that can fail
 */
@final
export class Bech32Result<T> {
    public readonly success: bool;
    public readonly value: T | null;
    public readonly error: string | null;

    public constructor(success: bool, value: T | null, error: string | null) {
        this.success = success;
        this.value = value;
        this.error = error;
    }

    public static ok<T>(value: T): Bech32Result<T> {
        return new Bech32Result<T>(true, value, null);
    }

    public static err<T>(error: string): Bech32Result<T> {
        return new Bech32Result<T>(false, null, error);
    }
}

@final
export class Bech32 {
    private static readonly CHARSET: string = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    private static decodeTbl: Int8Array | null = null;

    /**
     * Consider using encodeOrNull instead, this method will throw on error
     * @param hrp
     * @param witver
     * @param program
     */
    public static encode(hrp: string, witver: i32, program: Uint8Array): string {
        const result = Bech32.encodeOrNull(hrp, witver, program);
        if (!result) {
            throw new Revert('Bech32 encoding failed');
        }

        return result as string;
    }

    /**
     * Safe encode that returns null on error instead of throwing
     */
    public static encodeOrNull(hrp: string, witver: i32, program: Uint8Array): string | null {
        // Validate inputs
        if (witver < 0 || witver > 16) return null;
        if (witver == 0 && program.length != 20 && program.length != 32) return null;
        if (witver != 0 && (program.length < 2 || program.length > 40)) return null;

        // Build the 5-bit words array
        const wordsWB = new BytesWriter(1 + (program.length * 8 + 4) / 5);
        wordsWB.writeU8(<u8>witver);

        const convertResult = Bech32.convertBitsSafe(program, 8, 5, true);
        if (!convertResult.success) return null;

        if (convertResult.value === null) {
            throw new Revert('Bech32 convertBits failed with unknown error');
        }

        wordsWB.writeBytes(convertResult.value as Uint8Array);

        const data = wordsWB.getBuffer().subarray(0, <i32>wordsWB.getOffset());
        const chk = Bech32.createChecksum(hrp, data, /*bech32m*/ witver != 0);

        // Build final output
        const totalLen = hrp.length + 1 + data.length + chk.length;
        const outWB = new BytesWriter(totalLen);

        for (let i = 0; i < hrp.length; i++) {
            outWB.writeU8(<u8>hrp.charCodeAt(i));
        }
        outWB.writeU8(49); // '1' separator

        for (let i = 0; i < data.length; i++) {
            outWB.writeU8(<u8>Bech32.CHARSET.charCodeAt(data[i]));
        }

        for (let i = 0; i < chk.length; i++) {
            outWB.writeU8(<u8>Bech32.CHARSET.charCodeAt(chk[i]));
        }

        return String.UTF8.decode(outWB.getBuffer().buffer);
    }

    /**
     * Consider using decodeOrNull instead, this method will throw on error
     * @param addr
     */
    public static decode(addr: string): SegwitDecoded {
        const result = Bech32.decodeOrNull(addr);
        if (!result) {
            throw new Revert('Bech32 decode failed');
        }

        return result as SegwitDecoded;
    }

    /**
     * Safe decode that returns null on error
     */
    public static decodeOrNull(addr: string): SegwitDecoded | null {
        const L = addr.length;

        // Validate basic length constraints
        if (L < 8 || L > 90) return null;

        let lower = false;
        let upper = false;
        let pos = -1;

        // Scan for separator and validate characters
        for (let i = 0; i < L; i++) {
            const c = addr.charCodeAt(i);
            if (c < 33 || c > 126) return null;

            if (c >= 97 && c <= 122) lower = true;
            else if (c >= 65 && c <= 90) upper = true;

            if (c == 49) pos = i; // '1' separator
        }

        // Check case consistency
        if (lower && upper) return null;

        // Validate separator position
        if (pos < 1 || pos + 7 > L) return null;

        // Extract HRP and normalize to lowercase
        const hrp = lower ? addr.substring(0, pos) : addr.substring(0, pos).toLowerCase();

        // Decode the data part
        const dpLen = L - pos - 1;
        const data = new Uint8Array(dpLen);

        Bech32.ensureTable();
        const tbl = changetype<Int8Array>(Bech32.decodeTbl);

        for (let i = 0; i < dpLen; i++) {
            let c = addr.charCodeAt(pos + 1 + i);
            // Normalize to lowercase if needed
            if (!lower && c >= 65 && c <= 90) c += 32;

            const v = c < 128 ? unchecked(tbl[c]) : -1;
            if (v < 0) return null;

            data[i] = <u8>v;
        }

        // Verify checksum
        const w = new BytesWriter(hrp.length * 2 + 1 + dpLen);
        w.writeBytes(Bech32.hrpExpand(hrp));
        w.writeBytes(data);

        const pm = Bech32.polymod(w.getBuffer().subarray(0, <i32>w.getOffset()));
        const witver = <i32>data[0];

        if (witver < 0 || witver > 16) return null;

        // Check if checksum matches for either bech32 or bech32m
        let constOK = false;
        if ((pm ^ 1) == 0) constOK = witver == 0; // bech32 for v0
        if ((pm ^ 0x2bc830a3) == 0) constOK = witver != 0; // bech32m for v1+

        if (!constOK) return null;

        // Extract witness program
        const words = data.subarray(0, dpLen - 6);
        const progWords = words.subarray(1);

        const convertResult = Bech32.convertBitsSafe(progWords, 5, 8, false);
        if (!convertResult.success) return null;

        const program = convertResult.value!;

        // Validate program length based on witness version
        if (witver == 0) {
            const Lp = program.length;
            if (Lp != 20 && Lp != 32) return null;
        } else {
            const Lp = program.length;
            if (Lp < 2 || Lp > 40) return null;
        }

        return new SegwitDecoded(hrp, witver, program);
    }

    /**
     * Ensure the decode table is initialized
     * This is safe to call multiple times
     */
    private static ensureTable(): void {
        if (Bech32.decodeTbl) return;

        const t = new Int8Array(128);
        for (let i = 0; i < 128; i++) {
            unchecked((t[i] = -1));
        }

        for (let i = 0; i < 32; i++) {
            const c = Bech32.CHARSET.charCodeAt(i);
            if (c < 128) {
                unchecked((t[c] = <i8>i));
            }
        }

        Bech32.decodeTbl = t;
    }

    /**
     * Expand human-readable part for checksum computation
     */
    private static hrpExpand(hrp: string): Uint8Array {
        const L = hrp.length;
        const w = new BytesWriter(L * 2 + 1);

        // High bits of each character
        for (let i = 0; i < L; i++) {
            w.writeU8(<u8>(hrp.charCodeAt(i) >>> 5));
        }

        w.writeU8(0); // Separator

        // Low bits of each character
        for (let i = 0; i < L; i++) {
            w.writeU8(<u8>(hrp.charCodeAt(i) & 31));
        }

        return w.getBuffer();
    }

    /**
     * Compute Bech32 checksum polymod
     */
    private static polymod(values: Uint8Array): u32 {
        let chk: u32 = 1;

        // Generator polynomial coefficients
        const G0: u32 = 0x3b6a57b2;
        const G1: u32 = 0x26508e6d;
        const G2: u32 = 0x1ea119fa;
        const G3: u32 = 0x3d4233dd;
        const G4: u32 = 0x2a1462b3;

        const L = values.length;
        for (let i = 0; i < L; i++) {
            const top = chk >>> 25;
            chk = ((chk & 0x1ffffff) << 5) ^ (<u32>unchecked(values[i]));

            if ((top & 1) != 0) chk ^= G0;
            if ((top & 2) != 0) chk ^= G1;
            if ((top & 4) != 0) chk ^= G2;
            if ((top & 8) != 0) chk ^= G3;
            if ((top & 16) != 0) chk ^= G4;
        }

        return chk;
    }

    /**
     * Consider using convertBitsSafe instead, this method will throw on error
     */
    private static convertBits(
        data: Uint8Array,
        fromBits: i32,
        toBits: i32,
        pad: bool,
    ): Uint8Array {
        const result = Bech32.convertBitsSafe(data, fromBits, toBits, pad);
        if (!result.success) {
            if (!result.error) {
                throw new Revert('Bech32 convertBits failed with unknown error');
            }

            throw new Revert(result.error);
        }
        return result.value!;
    }

    /**
     * Safe version of convertBits that returns a result object
     */
    private static convertBitsSafe(
        data: Uint8Array,
        fromBits: i32,
        toBits: i32,
        pad: bool,
    ): Bech32Result<Uint8Array> {
        let acc: i32 = 0;
        let bits: i32 = 0;
        const maxv = (1 << toBits) - 1;

        // Calculate output length
        const outLen64: i64 = pad
            ? (<i64>data.length * fromBits + (toBits - 1)) / toBits
            : (<i64>data.length * fromBits) / toBits;

        if (outLen64 > <i64>0x7fffffff) {
            return Bech32Result.err<Uint8Array>('convertBits outLen overflow');
        }

        const wb = new BytesWriter(<i32>outLen64);
        const L = data.length;

        for (let i = 0; i < L; i++) {
            const v = <i32>unchecked(data[i]);

            // Validate input value
            if (v < 0 || v >> fromBits != 0) {
                return Bech32Result.err<Uint8Array>('invalid value');
            }

            acc = (acc << fromBits) | v;
            bits += fromBits;

            while (bits >= toBits) {
                bits -= toBits;
                wb.writeU8(<u8>((acc >> bits) & maxv));
            }
        }

        if (pad) {
            if (bits > 0) {
                wb.writeU8(<u8>((acc << (toBits - bits)) & maxv));
            }
        } else {
            if (bits >= fromBits) {
                return Bech32Result.err<Uint8Array>('excess padding');
            }
            if (((acc << (toBits - bits)) & maxv) != 0) {
                return Bech32Result.err<Uint8Array>('non-zero padding');
            }
        }

        return Bech32Result.ok<Uint8Array>(wb.getBuffer().subarray(0, <i32>wb.getOffset()));
    }

    private static createChecksum(hrp: string, data: Uint8Array, bech32m: bool): Uint8Array {
        const hrpEx = Bech32.hrpExpand(hrp);
        const w = new BytesWriter(hrpEx.length + data.length + 6);

        w.writeBytes(hrpEx);
        w.writeBytes(data);

        // Add 6 zero bytes for checksum calculation
        for (let i = 0; i < 6; i++) {
            w.writeU8(0);
        }

        const pm =
            Bech32.polymod(w.getBuffer().subarray(0, <i32>w.getOffset())) ^
            (bech32m ? 0x2bc830a3 : 1);

        const out = new Uint8Array(6);
        for (let p = 0; p < 6; p++) {
            out[p] = <u8>((pm >>> (5 * (5 - p))) & 31);
        }

        return out;
    }
}
