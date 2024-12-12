import { u256 } from '@btc-vision/as-bignum/assembly';

export interface StorageBacked {
    serialize(): Array<u256>;
}
