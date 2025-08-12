import { SegwitDecoded } from './ScriptUtils';
import { hash160, sha256 } from '../env/global';
import { Bech32 } from './Bech32';

@final
export class Segwit {
    public static p2wsh(hrp: string, witnessScript: Uint8Array): string {
        const program = sha256(witnessScript);
        return Bech32.encode(hrp, 0, program);
    }

    public static p2wpkh(hrp: string, pubkey: Uint8Array): string {
        const program = hash160(pubkey);
        return Bech32.encode(hrp, 0, program);
    }

    public static p2tr(hrp: string, outputKeyX32: Uint8Array): string {
        if (outputKeyX32.length != 32) throw new Error('taproot key must be 32 bytes');
        return Bech32.encode(hrp, 1, outputKeyX32);
    }

    public static decode(address: string): SegwitDecoded {
        return Bech32.decode(address);
    }
}
