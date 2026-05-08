import { BaseStoredString } from './BaseStoredString';
import { SafeMath } from '../types/SafeMath';
import { u256 } from '@btc-vision/as-bignum/assembly';

/**
 * @class StoredString
 * @description
 * Stores a string with an index-based subPointer calculation.
 * Maximum length: 4,294,967,295 bytes (u32.MAX_VALUE)
 */
@final
export class StoredString extends BaseStoredString {
    private static readonly DEFAULT_MAX_LENGTH: u32 = <u32>u32.MAX_VALUE;
    private static readonly MAX_LENGTH_U256: u256 = u256.fromU32(
        <u32>StoredString.DEFAULT_MAX_LENGTH,
    );

    constructor(pointer: u16, index: u64 = 0) {
        const indexed = SafeMath.mul(u256.fromU64(index), StoredString.MAX_LENGTH_U256);
        const subPointer = indexed.toUint8Array(true).slice(2, 32);

        super(pointer, subPointer, StoredString.DEFAULT_MAX_LENGTH);
    }

    protected getClassName(): string {
        return 'StoredString';
    }
}
