import { BytesWriter } from '../buffer/BytesWriter';
import { SegwitDecoded } from './ScriptUtils';

@final
export class Bech32 {
    private static readonly CHARSET: string = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    private static decodeTbl: Int8Array | null = null;

    public static encode(hrp: string, witver: i32, program: Uint8Array): string {
        if (witver < 0 || witver > 16) throw new Error('bad witness version');
        if (witver == 0 && program.length != 20 && program.length != 32)
            throw new Error('bad v0 program length');
        if (witver != 0 && (program.length < 2 || program.length > 40))
            throw new Error('bad v1+ program length');

        const wordsWB = new BytesWriter(1 + (program.length * 8 + 4) / 5);
        wordsWB.writeU8(<u8>witver);
        const words = Bech32.convertBits(program, 8, 5, true);
        wordsWB.writeBytes(words);

        const data = wordsWB.getBuffer().subarray(0, <i32>wordsWB.getOffset());
        const chk = Bech32.createChecksum(hrp, data, /*bech32m*/ witver != 0);

        const totalLen = hrp.length + 1 + data.length + chk.length; // ASCII only
        const outWB = new BytesWriter(totalLen);
        for (let i = 0; i < hrp.length; i++) outWB.writeU8(<u8>hrp.charCodeAt(i));
        outWB.writeU8(49); // '1'
        for (let i = 0; i < data.length; i++) outWB.writeU8(<u8>Bech32.CHARSET.charCodeAt(data[i]));
        for (let i = 0; i < chk.length; i++) outWB.writeU8(<u8>Bech32.CHARSET.charCodeAt(chk[i]));

        return String.UTF8.decode(outWB.getBuffer().buffer);
    }

    public static decode(addr: string): SegwitDecoded {
        const L = addr.length;
        if (L < 8 || L > 90) throw new Error('bad length');
        let lower = false,
            upper = false,
            pos = -1;
        for (let i = 0; i < L; i++) {
            const c = addr.charCodeAt(i);
            if (c < 33 || c > 126) throw new Error('invalid char');
            if (c >= 97 && c <= 122) lower = true;
            else if (c >= 65 && c <= 90) upper = true;
            if (c == 49) pos = i;
        }
        if (lower && upper) throw new Error('mixed case');
        if (pos < 1 || pos + 7 > L) throw new Error('bad sep');
        const hrp = lower ? addr.substring(0, pos) : addr.substring(0, pos).toLowerCase();
        const dpLen = L - pos - 1;
        const data = new Uint8Array(dpLen);
        Bech32.ensureTable();
        const tbl = changetype<Int8Array>(Bech32.decodeTbl);
        for (let i = 0; i < dpLen; i++) {
            let c = addr.charCodeAt(pos + 1 + i);
            if (!lower && c >= 65 && c <= 90) c += 32;
            const v = c < 128 ? unchecked(tbl[c]) : -1;
            if (v < 0) throw new Error('bad bech char');
            data[i] = <u8>v;
        }
        const w = new BytesWriter(hrp.length * 2 + 1 + dpLen);
        w.writeBytes(Bech32.hrpExpand(hrp));
        w.writeBytes(data);
        const pm = Bech32.polymod(w.getBuffer().subarray(0, <i32>w.getOffset()));
        const witver = <i32>data[0];
        if (witver < 0 || witver > 16) throw new Error('bad witness version');
        let constOK: bool = false;
        if ((pm ^ 1) == 0) constOK = witver == 0;
        if ((pm ^ 0x2bc830a3) == 0) constOK = witver != 0;
        if (!constOK) throw new Error('checksum/version mismatch');
        const words = data.subarray(0, dpLen - 6);
        const progWords = words.subarray(1);
        const program = Bech32.convertBits(progWords, 5, 8, false);
        if (witver == 0) {
            const Lp = program.length;
            if (Lp != 20 && Lp != 32) throw new Error('bad v0 program length');
        } else {
            const Lp = program.length;
            if (Lp < 2 || Lp > 40) throw new Error('bad v1+ program length');
        }
        return new SegwitDecoded(hrp, witver, program);
    }

    private static ensureTable(): void {
        if (Bech32.decodeTbl) return;
        const t = new Int8Array(128);
        for (let i = 0; i < 128; i++) unchecked((t[i] = -1));
        for (let i = 0; i < 32; i++) {
            const c = Bech32.CHARSET.charCodeAt(i);
            if (c < 128) unchecked((t[c] = <i8>i));
        }
        Bech32.decodeTbl = t;
    }

    private static hrpExpand(hrp: string): Uint8Array {
        const L = hrp.length;
        const w = new BytesWriter(L * 2 + 1);
        for (let i = 0; i < L; i++) w.writeU8(<u8>(hrp.charCodeAt(i) >>> 5));
        w.writeU8(0);
        for (let i = 0; i < L; i++) w.writeU8(<u8>(hrp.charCodeAt(i) & 31));
        return w.getBuffer();
    }

    private static polymod(values: Uint8Array): u32 {
        let chk: u32 = 1;
        const G0: u32 = 0x3b6a57b2,
            G1: u32 = 0x26508e6d,
            G2: u32 = 0x1ea119fa,
            G3: u32 = 0x3d4233dd,
            G4: u32 = 0x2a1462b3;
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

    private static convertBits(
        data: Uint8Array,
        fromBits: i32,
        toBits: i32,
        pad: bool,
    ): Uint8Array {
        let acc: i32 = 0,
            bits: i32 = 0;
        const maxv = (1 << toBits) - 1;
        const outLen64: i64 = pad
            ? (<i64>data.length * fromBits + (toBits - 1)) / toBits
            : (<i64>data.length * fromBits) / toBits;
        if (outLen64 > <i64>0x7fffffff) throw new Error('convertBits outLen overflow');
        const wb = new BytesWriter(<i32>outLen64);
        const L = data.length;
        for (let i = 0; i < L; i++) {
            const v = <i32>unchecked(data[i]);
            if (v < 0 || v >> fromBits != 0) throw new Error('invalid value');
            acc = (acc << fromBits) | v;
            bits += fromBits;
            while (bits >= toBits) {
                bits -= toBits;
                wb.writeU8(<u8>((acc >> bits) & maxv));
            }
        }
        if (pad) {
            if (bits > 0) wb.writeU8(<u8>((acc << (toBits - bits)) & maxv));
        } else {
            if (bits >= fromBits) throw new Error('excess padding');
            if (((acc << (toBits - bits)) & maxv) != 0) throw new Error('non-zero padding');
        }
        return wb.getBuffer().subarray(0, <i32>wb.getOffset());
    }

    private static createChecksum(hrp: string, data: Uint8Array, bech32m: bool): Uint8Array {
        const hrpEx = Bech32.hrpExpand(hrp);
        const w = new BytesWriter(hrpEx.length + data.length + 6);
        w.writeBytes(hrpEx);
        w.writeBytes(data);
        for (let i = 0; i < 6; i++) w.writeU8(0);
        const pm =
            Bech32.polymod(w.getBuffer().subarray(0, <i32>w.getOffset())) ^
            (bech32m ? 0x2bc830a3 : 1);
        const out = new Uint8Array(6);
        for (let p = 0; p < 6; p++) out[p] = <u8>((pm >>> (5 * (5 - p))) & 31);
        return out;
    }
}
