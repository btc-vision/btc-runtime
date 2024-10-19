import { u256 } from 'as-bignum/assembly';

export interface StorageBacked {
    serialize(): Array<u256>;
}
