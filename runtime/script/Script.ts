import { BytesWriter } from '../buffer/BytesWriter';
import { BitcoinOpcodes } from './Opcodes';
import { ScriptReader } from './reader/ScriptReader';
import { CsvRecognize, MultisigRecognize } from './ScriptUtils';

@final
export class ScriptNumber {
    public static encodedLen(x: i64): i32 {
        if (x == 0) return 0;
        let n = x < 0 ? -x : x;
        let bytes = 0;
        while (n > 0) {
            bytes++;
            n >>= 8;
        }
        const msb: u8 = <u8>(((x < 0 ? -x : x) >> (<i64>((bytes - 1) * 8))) & 0xff);
        return (msb & 0x80) != 0 ? bytes + 1 : bytes;
    }

    public static encode(x: i64): Uint8Array {
        const L = ScriptNumber.encodedLen(x);
        if (L == 0) return new Uint8Array(0);
        const neg = x < 0;
        let n = neg ? -x : x;
        const out = new Uint8Array(L);
        for (let i = 0; i < L; i++) {
            out[i] = <u8>(n & 0xff);
            n >>= 8;
        }
        if (neg) out[L - 1] |= 0x80;
        else if ((out[L - 1] & 0x80) != 0) out[L - 1] = 0x00; // ensure canonical positive
        return out;
    }

    public static decode(data: Uint8Array, minimal: bool = true): i64 {
        const L = data.length;
        if (L == 0) return 0;
        if (L > 4) throw new Error('ScriptNumber too large');
        if (minimal) {
            const msb = data[L - 1];
            if ((msb & 0x7f) == 0) {
                if (L == 1) throw new Error('non-minimal zero');
                if ((data[L - 2] & 0x80) == 0) throw new Error('non-minimal sign byte');
            }
        }

        let res: i64 = 0;
        for (let i = 0; i < L; i++) res |= (<i64>((<i64>data[i]) & 0xff)) << (<i64>8 * i);
        const neg = (data[L - 1] & 0x80) != 0;

        if (neg) {
            const mask: i64 = ~((<i64>0x80) << (<i64>8 * (L - 1)));
            res &= mask;
            res = -res;
        }
        return res;
    }
}

@final
export class ScriptIO {
    public static pushPrefixSize(len: i32): i32 {
        if (len == 0) return 1;
        if (len <= 75) return 1;
        if (len < 0x100) return 2;
        if (len < 0x10000) return 3;
        return 5;
    }

    public static writePush(w: BytesWriter, data: Uint8Array): void {
        const len = data.length;
        if (len == 0) {
            w.writeU8(BitcoinOpcodes.OP_0);
            return;
        }

        if (len <= 75) {
            w.writeU8(<u8>len);
            w.writeBytes(data);
            return;
        }

        if (len < 0x100) {
            w.writeU8(BitcoinOpcodes.OP_PUSHDATA1);
            w.writeU8(<u8>len);
            w.writeBytes(data);
            return;
        }

        if (len < 0x10000) {
            w.writeU8(BitcoinOpcodes.OP_PUSHDATA2);
            w.writeU8(<u8>len);
            w.writeU8(<u8>(len >>> 8));
            w.writeBytes(data);
            return;
        }

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
    public static csvTimelock(pubkey: Uint8Array, csvBlocks: i32): Uint8Array {
        if (csvBlocks < 0) throw new Error('csvBlocks must be >= 0');
        if (csvBlocks > 65535) throw new Error('csvBlocks exceeds 16-bit BIP-68 field');
        const pubLen = pubkey.length;

        let nPartSize = 0;
        if (csvBlocks == 0) nPartSize = 1;
        else if (csvBlocks <= 16) nPartSize = 1;
        else {
            const nBytes = ScriptNumber.encodedLen(csvBlocks);
            nPartSize = ScriptIO.pushPrefixSize(nBytes) + nBytes;
        }

        const sz =
            nPartSize +
            1 /*CSV*/ +
            1 /*DROP*/ +
            ScriptIO.pushPrefixSize(pubLen) +
            pubLen +
            1; /*CHECKSIG*/
        if (sz > 10000) throw new Error('script too large');
        const w = new BytesWriter(sz);

        if (csvBlocks == 0) w.writeU8(BitcoinOpcodes.OP_0);
        else if (csvBlocks <= 16) w.writeU8(BitcoinOpcodes.opN(csvBlocks));
        else {
            const enc = ScriptNumber.encode(csvBlocks);
            ScriptIO.writePush(w, enc);
        }

        w.writeU8(BitcoinOpcodes.OP_CHECKSEQUENCEVERIFY);
        w.writeU8(BitcoinOpcodes.OP_DROP);
        ScriptIO.writePush(w, pubkey);
        w.writeU8(BitcoinOpcodes.OP_CHECKSIG);
        return w.getBuffer().subarray(0, <i32>w.getOffset());
    }

    public static multisig(m: i32, pubkeys: Array<Uint8Array>): Uint8Array {
        const n = pubkeys.length;
        if (m < 1 || m > 16) throw new Error('m out of range');
        if (n < m || n > 16) throw new Error('n out of range');
        let sz = 1;
        for (let i = 0; i < n; i++) {
            const L = pubkeys[i].length;
            sz += ScriptIO.pushPrefixSize(L) + L;
        }
        sz += 1 + 1;
        if (sz > 10000) throw new Error('script too large');
        const w = new BytesWriter(sz);
        w.writeU8(BitcoinOpcodes.opN(m));
        for (let i = 0; i < n; i++) ScriptIO.writePush(w, pubkeys[i]);
        w.writeU8(BitcoinOpcodes.opN(n));
        w.writeU8(BitcoinOpcodes.OP_CHECKMULTISIG);
        return w.getBuffer().subarray(0, <i32>w.getOffset());
    }

    public static recognizeCsvTimelock(
        script: Uint8Array,
        strictMinimal: bool = true,
    ): CsvRecognize {
        const r = new ScriptReader(script);

        if (r.done()) return new CsvRecognize(false, -1, null);

        let t = r.next(strictMinimal);
        let csvBlocks: i64 = -1;
        let pubkey: Uint8Array | null = null;

        if (t.data !== null) {
            let v: i64 = 0;
            try {
                v = ScriptNumber.decode(t.data as Uint8Array, strictMinimal);
            } catch (_) {
                return new CsvRecognize(false, -1, null);
            }
            if (v < 0) return new CsvRecognize(false, -1, null);
            csvBlocks = v;
        } else {
            const op = t.op;
            if (op == BitcoinOpcodes.OP_1NEGATE) return new CsvRecognize(false, -1, null);
            if (op >= BitcoinOpcodes.OP_1 && op <= BitcoinOpcodes.OP_16)
                csvBlocks = <i64>(op - 0x50);
            else if (op == BitcoinOpcodes.OP_0) csvBlocks = 0;
            else return new CsvRecognize(false, -1, null);
        }

        if (r.done()) return new CsvRecognize(false, -1, null);
        t = r.next(strictMinimal);
        if (t.op != BitcoinOpcodes.OP_CHECKSEQUENCEVERIFY) return new CsvRecognize(false, -1, null);
        if (r.done()) return new CsvRecognize(false, -1, null);
        t = r.next(strictMinimal);
        if (t.op != BitcoinOpcodes.OP_DROP) return new CsvRecognize(false, -1, null);
        if (r.done()) return new CsvRecognize(false, -1, null);
        t = r.next(strictMinimal);
        if (t.data === null) return new CsvRecognize(false, -1, null);
        const pk = t.data as Uint8Array;
        const Lpk = pk.length;
        if (Lpk != 33 && Lpk != 65) return new CsvRecognize(false, -1, null);
        pubkey = pk;
        if (r.done()) return new CsvRecognize(false, -1, null);
        t = r.next(strictMinimal);
        if (t.op != BitcoinOpcodes.OP_CHECKSIG) return new CsvRecognize(false, -1, null);
        if (!r.done()) return new CsvRecognize(false, -1, null);
        return new CsvRecognize(true, csvBlocks, pubkey);
    }

    public static recognizeMultisig(
        script: Uint8Array,
        strictMinimal: bool = true,
    ): MultisigRecognize {
        const r = new ScriptReader(script);
        if (r.done()) return new MultisigRecognize(false, 0, 0, null);
        let t = r.next(strictMinimal);
        const opm = t.op;
        if (opm < BitcoinOpcodes.OP_1 || opm > BitcoinOpcodes.OP_16)
            return new MultisigRecognize(false, 0, 0, null);
        const m = opm - 0x50;
        const keys = new Array<Uint8Array>();
        while (!r.done()) {
            t = r.next(strictMinimal);
            if (t.data !== null) {
                const pk = t.data as Uint8Array;
                const L = pk.length;
                if (L != 33 && L != 65) return new MultisigRecognize(false, 0, 0, null);
                keys.push(pk);
                continue;
            }
            if (t.op < BitcoinOpcodes.OP_1 || t.op > BitcoinOpcodes.OP_16)
                return new MultisigRecognize(false, 0, 0, null);
            const n = t.op - 0x50;
            if (n != keys.length || n < m) return new MultisigRecognize(false, 0, 0, null);
            if (r.done()) return new MultisigRecognize(false, 0, 0, null);
            const t2 = r.next(strictMinimal);
            if (t2.op != BitcoinOpcodes.OP_CHECKMULTISIG)
                return new MultisigRecognize(false, 0, 0, null);
            if (!r.done()) return new MultisigRecognize(false, 0, 0, null);
            return new MultisigRecognize(true, m, n, keys);
        }
        return new MultisigRecognize(false, 0, 0, null);
    }
}
