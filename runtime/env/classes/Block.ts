import { u256 } from '@btc-vision/as-bignum/assembly';

@final
export class Block {
    private readonly u64BlockNumber: u64;

    public constructor(
        public readonly number: u256,
        public readonly medianTimestamp: u64,
    ) {
        this.u64BlockNumber = number.toU64();
    }

    public get numberU64(): u64 {
        return this.u64BlockNumber;
    }
}
