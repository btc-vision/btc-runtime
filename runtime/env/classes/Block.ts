import { u256 } from '@btc-vision/as-bignum/assembly';

@final
export class Block {
    public readonly numberU256: u256;

    public constructor(
        public readonly hash: Uint8Array,
        public readonly number: u64,
        public readonly medianTimestamp: u64,
    ) {
        this.numberU256 = u256.fromU64(number);
    }
}
