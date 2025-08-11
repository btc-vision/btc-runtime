export enum Networks {
    Mainnet,
    Testnet,
    Regtest,
}

@final
export class NetworkManager {
    private readonly mainnet: Uint8Array;
    private readonly testnet: Uint8Array;
    private readonly regtest: Uint8Array;

    constructor() {
        this.mainnet = new Uint8Array(32);
        this.mainnet.set([
            0x00, 0x00, 0x00, 0x00, 0x00, 0x19, 0xd6, 0x68, 0x9c, 0x08, 0x5a, 0xe1, 0x65, 0x83,
            0x1e, 0x93, 0x4f, 0xf7, 0x63, 0xae, 0x46, 0xa2, 0xa6, 0xc1, 0x72, 0xb3, 0xf1, 0xb6,
            0x0a, 0x8c, 0xe2, 0x6f,
        ]);

        this.testnet = new Uint8Array(32);
        this.testnet.set([
            0x00, 0x00, 0x00, 0x00, 0x09, 0x33, 0xea, 0x01, 0xad, 0x0e, 0xe9, 0x84, 0x20, 0x97,
            0x79, 0xba, 0xae, 0xc3, 0xce, 0xd9, 0x0f, 0xa3, 0xf4, 0x08, 0x71, 0x95, 0x26, 0xf8,
            0xd7, 0x7f, 0x49, 0x43,
        ]);

        this.regtest = new Uint8Array(32);
        this.regtest.set([
            0x0f, 0x91, 0x88, 0xf1, 0x3c, 0xb7, 0xb2, 0xc7, 0x1f, 0x2a, 0x33, 0x5e, 0x3a, 0x4f,
            0xc3, 0x28, 0xbf, 0x5b, 0xeb, 0x43, 0x60, 0x12, 0xaf, 0xca, 0x59, 0x0b, 0x1a, 0x11,
            0x46, 0x6e, 0x22, 0x06,
        ]);
    }

    public static hrp(n: Networks): string {
        return n == Networks.Mainnet ? 'bc' : n == Networks.Testnet ? 'tb' : 'bcrt';
    }

    public getChainId(network: Networks): Uint8Array {
        const out = new Uint8Array(32);
        switch (network) {
            case Networks.Mainnet:
                out.set(this.mainnet);
                return out;
            case Networks.Testnet:
                out.set(this.testnet);
                return out;
            case Networks.Regtest:
                out.set(this.regtest);
                return out;
            default:
                throw new Error('Unknown network');
        }
    }

    public fromChainId(chainId: Uint8Array): Networks {
        if (chainId.length !== 32) {
            throw new Error('Invalid chain id length');
        }
        if (this.equals(chainId, this.mainnet)) return Networks.Mainnet;
        if (this.equals(chainId, this.testnet)) return Networks.Testnet;
        if (this.equals(chainId, this.regtest)) return Networks.Regtest;
        throw new Error('Unknown chain id');
    }

    private equals(a: Uint8Array, b: Uint8Array): boolean {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }
}

export const Network: NetworkManager = new NetworkManager();
