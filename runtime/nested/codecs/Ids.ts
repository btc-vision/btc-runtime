import { i128, u128, u256 } from '@btc-vision/as-bignum/assembly';
import { Uint8Array } from 'typedarray';
import { Address } from '../../types/Address';

export const idOfU256 = idof<u256>();
export const idOfU128 = idof<u128>();
export const idOfI128 = idof<i128>();
export const idOfUint8Array = idof<Uint8Array>();
export const idOfString = idof<string>();
export const idOfAddress = idof<Address>();