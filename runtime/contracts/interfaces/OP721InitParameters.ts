import { u256 } from '@btc-vision/as-bignum/assembly';

export class OP721InitParameters {
    public name: string;
    public symbol: string;
    public baseURI: string;
    public maxSupply: u256;

    constructor(name: string, symbol: string, baseURI: string, maxSupply: u256) {
        this.name = name;
        this.symbol = symbol;
        this.baseURI = baseURI;
        this.maxSupply = maxSupply;
    }
}
