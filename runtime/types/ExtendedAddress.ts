import { Potential } from '../lang/Definitions';
import { decodeHexArray } from '../utils';
import { Blockchain } from '../env';
import { Network } from '../script/Networks';
import { Address } from './Address';
import { BitcoinAddresses } from '../script/BitcoinAddresses';

@final
export class ExtendedAddress extends Address {
    private readonly tweakedPublicKey: Uint8Array;

    /**
     * Creates a new ExtendedAddress instance.
     * @param tweakedPublicKey - Tweaked Schnorr public key
     * @param publicKey - MLDSA public key SHA256(ml-dsa-public-key)
     */
    public constructor(tweakedPublicKey: u8[], publicKey: u8[]) {
        super(publicKey);

        if (tweakedPublicKey.length !== 32) {
            throw new Error('Tweaked public key must be 32 bytes long');
        }

        this.tweakedPublicKey = new Uint8Array(32);
        this.tweakedPublicKey.set(tweakedPublicKey);
    }

    /**
     * Dead address (284ae4acdb32a99ba3ebfa66a91ddb41a7b7a1d2fef415399922cd8a04485c02)
     * generated from 04678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5f
     */
    public static dead(): ExtendedAddress {
        return DEAD_ADDRESS.clone();
    }

    public static zero(): ExtendedAddress {
        return ZERO_BITCOIN_ADDRESS.clone();
    }

    /**
     * Disabled: Use fromStringPair instead
     * @deprecated
     */
    public static override fromString(_: string): Address {
        ERROR(
            `Use ExtendedAddress.fromStringPair instead. This method is disabled. You must provide both the tweaked public key and the MLDSA public key.`,
        );
    }

    /**
     * Create ExtendedAddress from both tweaked public key and MLDSA public key
     * This is the preferred method for ExtendedAddress creation
     */
    public static fromStringPair(tweakedPubKey: string, mldsaPubKey: string): ExtendedAddress {
        if (tweakedPubKey.startsWith('0x')) {
            tweakedPubKey = tweakedPubKey.slice(2);
        }

        if (mldsaPubKey.startsWith('0x')) {
            mldsaPubKey = mldsaPubKey.slice(2);
        }

        return new ExtendedAddress(decodeHexArray(tweakedPubKey), decodeHexArray(mldsaPubKey));
    }

    public static fromUint8Array(bytes: Uint8Array): ExtendedAddress {
        if (bytes.length !== 64) {
            throw new Error('Expected 64 bytes: 32 for tweakedPublicKey, 32 for publicKey');
        }

        const tweakedPublicKey: u8[] = new Array<u8>(32);
        const publicKey: u8[] = new Array<u8>(32);

        for (let i = 0; i < 32; i++) {
            tweakedPublicKey[i] = bytes[i];
            publicKey[i] = bytes[32 + i];
        }

        return new ExtendedAddress(tweakedPublicKey, publicKey);
    }

    public static toCSV(address: Uint8Array, blocks: u32): string {
        return BitcoinAddresses.csvP2wshAddress(address, blocks, Network.hrp(Blockchain.network))
            .address;
    }

    public static p2wpkh(address: Uint8Array): string {
        return BitcoinAddresses.p2wpkh(address, Network.hrp(Blockchain.network));
    }

    public downCast(): Address {
        return this;
    }

    public isZero(): bool {
        for (let i = 0; i < this.length; i++) {
            if (this[i] != 0) {
                return false;
            }
        }

        return true;
    }

    public isDead(): bool {
        for (let i = 0; i < this.length; i++) {
            if (this[i] != DEAD_ADDRESS[i]) {
                return false;
            }
        }
        return true;
    }

    public p2tr(): string {
        return BitcoinAddresses.p2trKeyPathAddress(this, Network.hrp(Blockchain.network));
    }

    public toString(): string {
        return this.p2tr();
    }

    public override clone(): ExtendedAddress {
        // Convert Uint8Array to u8[] for the tweakedPublicKey
        const tweakedKeyArray: u8[] = new Array<u8>(this.tweakedPublicKey.length);
        for (let i = 0; i < this.tweakedPublicKey.length; i++) {
            tweakedKeyArray[i] = this.tweakedPublicKey[i];
        }

        // Convert the address bytes (this.slice(0)) to u8[]
        const addressSlice = this.slice(0);
        const addressArray: u8[] = new Array<u8>(addressSlice.length);
        for (let i = 0; i < addressSlice.length; i++) {
            addressArray[i] = addressSlice[i];
        }

        const cloned = new ExtendedAddress(tweakedKeyArray, addressArray);

        // Duplicate the isDefined flag as well:
        cloned.isDefined = this.isDefined;

        return cloned;
    }
}

export const ZERO_BITCOIN_ADDRESS: ExtendedAddress = new ExtendedAddress(
    [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0,
    ],
    [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0,
    ],
);

export const DEAD_ADDRESS: ExtendedAddress = new ExtendedAddress(
    [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0,
    ],
    [
        40, 74, 228, 172, 219, 50, 169, 155, 163, 235, 250, 102, 169, 29, 219, 65, 167, 183, 161,
        210, 254, 244, 21, 57, 153, 34, 205, 138, 4, 72, 92, 2,
    ],
);

export declare type PotentialBitcoinAddress = Potential<ExtendedAddress>;
