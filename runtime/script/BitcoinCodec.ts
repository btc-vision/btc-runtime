import { BitcoinAddresses, Ct } from './BitcoinAddresses';
import { BytesWriter } from '../buffer/BytesWriter';
import { BytesReader } from '../buffer/BytesReader';
import { CsvPairCrossCheck, MultisigPairCrossCheck, SegwitDecoded, VerifyResult, } from './ScriptUtils';
import { Segwit } from './Segwit';
import { sha256 } from '../env/global';
import { BitcoinScript } from './Script';

@final
export class BitcoinCodec {
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

    public static readAndVerifyCsvP2wsh(
        inp: BytesReader,
        pubkey: Uint8Array,
        csvBlocks: i32,
        hrp: string,
        strictMinimal: bool = true,
    ): bool {
        const addr = inp.readStringWithLength();
        return BitcoinAddresses.verifyCsvP2wshAddress(pubkey, csvBlocks, addr, hrp, strictMinimal);
    }

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

    public static readAndVerifyMultisigP2wsh(
        inp: BytesReader,
        m: i32,
        pubkeys: Array<Uint8Array>,
        hrp: string,
    ): bool {
        const addr = inp.readStringWithLength();
        return BitcoinAddresses.verifyMultisigP2wshAddress(m, pubkeys, addr, hrp);
    }

    public static writeP2tr(out: BytesWriter, outputKeyX32: Uint8Array, hrp: string): void {
        const addr = BitcoinAddresses.p2trKeyPathAddress(outputKeyX32, hrp);
        out.writeStringWithLength(addr);
    }

    public static readAndVerifyP2tr(inp: BytesReader, outputKeyX32: Uint8Array, hrp: string): bool {
        const addr = inp.readStringWithLength();
        return BitcoinAddresses.verifyP2trAddress(outputKeyX32, addr, hrp);
    }

    public static readP2wshPairAndVerify(inp: BytesReader, hrp: string): VerifyResult {
        const address = inp.readStringWithLength();
        const witnessScript = inp.readBytesWithLength();
        let dec: SegwitDecoded;
        try {
            dec = Segwit.decode(address);
        } catch (_) {
            return new VerifyResult(false);
        }
        if (dec.version != 0 || dec.hrp != hrp || dec.program.length != 32)
            return new VerifyResult(false);
        const prog = sha256(witnessScript);
        return new VerifyResult(Ct.eq32(dec.program, prog));
    }

    public static readCsvP2wshPairAndCrossCheck(
        inp: BytesReader,
        hrp: string,
        strictMinimal: bool = true,
    ): CsvPairCrossCheck {
        const address = inp.readStringWithLength();
        const witnessScript = inp.readBytesWithLength();
        let dec: SegwitDecoded;
        try {
            dec = Segwit.decode(address);
        } catch (_) {
            return new CsvPairCrossCheck(false, address, witnessScript, -1, null);
        }
        if (dec.version != 0 || dec.hrp != hrp || dec.program.length != 32)
            return new CsvPairCrossCheck(false, address, witnessScript, -1, null);
        const prog = sha256(witnessScript);
        if (!Ct.eq32(dec.program, prog))
            return new CsvPairCrossCheck(false, address, witnessScript, -1, null);
        const rec = BitcoinScript.recognizeCsvTimelock(witnessScript, strictMinimal);
        if (!rec.ok) return new CsvPairCrossCheck(false, address, witnessScript, -1, null);
        return new CsvPairCrossCheck(true, address, witnessScript, rec.csvBlocks, rec.pubkey);
    }

    public static readMultisigP2wshPairAndCrossCheck(
        inp: BytesReader,
        hrp: string,
        expectedM: i32 = -1,
        expectedPubkeys: Array<Uint8Array> | null = null,
        strictMinimal: bool = true,
    ): MultisigPairCrossCheck {
        const address = inp.readStringWithLength();
        const witnessScript = inp.readBytesWithLength();

        let dec: SegwitDecoded;
        try {
            dec = Segwit.decode(address);
        } catch (_) {
            return new MultisigPairCrossCheck(false, 0, 0, address);
        }

        if (dec.version != 0 || dec.hrp != hrp || dec.program.length != 32) {
            return new MultisigPairCrossCheck(false, 0, 0, address);
        }

        const prog = sha256(witnessScript);
        if (!Ct.eq32(dec.program, prog)) return new MultisigPairCrossCheck(false, 0, 0, address);

        const rec = BitcoinScript.recognizeMultisig(witnessScript, strictMinimal);
        if (!rec.ok) {
            return new MultisigPairCrossCheck(false, 0, 0, address);
        }

        if (expectedM >= 0 && rec.m != expectedM) {
            return new MultisigPairCrossCheck(false, rec.m, rec.n, address);
        }

        if (expectedPubkeys !== null) {
            const ks = rec.pubkeys as Array<Uint8Array>;
            if (ks.length != expectedPubkeys.length)
                return new MultisigPairCrossCheck(false, rec.m, rec.n, address);
            for (let i = 0; i < ks.length; i++) {
                const a = ks[i],
                    b = expectedPubkeys[i];
                if (a.length != b.length)
                    return new MultisigPairCrossCheck(false, rec.m, rec.n, address);
                let d = 0;
                for (let j = 0, L = a.length; j < L; j++) d |= a[j] ^ b[j];
                if (d != 0) return new MultisigPairCrossCheck(false, rec.m, rec.n, address);
            }
        }

        return new MultisigPairCrossCheck(true, rec.m, rec.n, address);
    }
}
