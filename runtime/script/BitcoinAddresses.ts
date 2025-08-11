import { CsvP2wshResult, MultisigP2wshResult, SegwitDecoded } from './ScriptUtils';
import { Segwit } from './Segwit';
import { BitcoinScript } from './Script';
import { sha256 } from '../env/global';

@final
export class Ct {
    @inline public static eq32(a: Uint8Array, b: Uint8Array): bool {
        let d: i32 = (a.length ^ 32) | (b.length ^ 32);
        for (let i = 0; i < 32; i++) {
            const ai: u8 = i < a.length ? a[i] : 0;
            const bi: u8 = i < b.length ? b[i] : 0;
            d |= ai ^ bi;
        }
        return d == 0;
    }
}

@final
export class BitcoinAddresses {
    public static csvWitnessScript(pubkey: Uint8Array, csvBlocks: i32): Uint8Array {
        return BitcoinScript.csvTimelock(pubkey, csvBlocks);
    }

    public static csvP2wshAddress(pubkey: Uint8Array, csvBlocks: i32, hrp: string): CsvP2wshResult {
        const ws = BitcoinAddresses.csvWitnessScript(pubkey, csvBlocks);
        const addr = Segwit.p2wsh(hrp, ws);
        return new CsvP2wshResult(addr, ws);
    }

    public static verifyCsvP2wshAddress(
        pubkey: Uint8Array,
        csvBlocks: i32,
        address: string,
        hrp: string,
        strictMinimal: bool = true,
    ): bool {
        let dec: SegwitDecoded;
        try {
            dec = Segwit.decode(address);
        } catch (_) {
            return false;
        }
        if (dec.version != 0 || dec.hrp != hrp || dec.program.length != 32) return false;
        const ws = BitcoinAddresses.csvWitnessScript(pubkey, csvBlocks);
        const rec = BitcoinScript.recognizeCsvTimelock(ws, strictMinimal);
        if (!rec.ok || rec.csvBlocks != csvBlocks) return false;
        const prog = sha256(ws);
        return Ct.eq32(dec.program, prog);
    }

    public static multisigWitnessScript(m: i32, pubkeys: Array<Uint8Array>): Uint8Array {
        return BitcoinScript.multisig(m, pubkeys);
    }

    public static multisigP2wshAddress(
        m: i32,
        pubkeys: Array<Uint8Array>,
        hrp: string,
    ): MultisigP2wshResult {
        const ws = BitcoinAddresses.multisigWitnessScript(m, pubkeys);
        const addr = Segwit.p2wsh(hrp, ws);
        return new MultisigP2wshResult(addr, ws);
    }

    public static verifyMultisigP2wshAddress(
        m: i32,
        pubkeys: Array<Uint8Array>,
        address: string,
        hrp: string,
    ): bool {
        let dec: SegwitDecoded;
        try {
            dec = Segwit.decode(address);
        } catch (_) {
            return false;
        }
        if (dec.version != 0 || dec.hrp != hrp || dec.program.length != 32) return false;
        const ws = BitcoinAddresses.multisigWitnessScript(m, pubkeys);
        const prog = sha256(ws);
        return Ct.eq32(dec.program, prog);
    }

    public static p2trKeyPathAddress(outputKeyX32: Uint8Array, hrp: string): string {
        return Segwit.p2tr(hrp, outputKeyX32);
    }

    public static verifyP2trAddress(outputKeyX32: Uint8Array, address: string, hrp: string): bool {
        let dec: SegwitDecoded;
        try {
            dec = Segwit.decode(address);
        } catch (_) {
            return false;
        }
        if (dec.version != 1 || dec.hrp != hrp || dec.program.length != 32) return false;
        return Ct.eq32(dec.program, outputKeyX32);
    }
}
