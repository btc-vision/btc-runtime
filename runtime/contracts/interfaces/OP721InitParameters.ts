import { u256 } from '@btc-vision/as-bignum/assembly';

export class OP721InitParameters {
    public name: string;
    public symbol: string;
    public baseURI: string;
    public maxSupply: u256;

    public collectionBanner: string;
    public collectionIcon: string;
    public collectionWebsite: string;
    public collectionDescription: string;

    constructor(
        name: string,
        symbol: string,
        baseURI: string,
        maxSupply: u256,
        collectionBanner: string = '',
        collectionIcon: string = '',
        collectionWebsite: string = '',
        collectionDescription: string = '',
    ) {
        this.name = name;
        this.symbol = symbol;
        this.baseURI = baseURI;
        this.maxSupply = maxSupply;

        this.collectionBanner = collectionBanner;
        this.collectionIcon = collectionIcon;
        this.collectionWebsite = collectionWebsite;
        this.collectionDescription = collectionDescription;
    }
}
