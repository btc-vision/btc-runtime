import { u256 } from '@btc-vision/as-bignum/assembly';

export class OP20InitParameters {
    readonly maxSupply: u256;
    readonly decimals: u8;
    readonly name: string;
    readonly symbol: string;
    readonly icon: string;

    constructor(maxSupply: u256, decimals: u8, name: string, symbol: string, icon: string = '') {
        this.maxSupply = maxSupply;
        this.decimals = decimals;
        this.name = name;
        this.symbol = symbol;
        this.icon = icon;
    }
}
