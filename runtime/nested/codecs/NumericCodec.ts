import { i128, u128, u256 } from '@btc-vision/as-bignum/assembly';
import { ICodec } from '../interfaces/ICodec';
import { BytesWriter } from '../../buffer/BytesWriter';
import { BytesReader } from '../../buffer/BytesReader';
import { idOfI128, idOfU128, idOfU256 } from './Ids';

/**
 * A generic NumericCodec<T> that handles:
 *  - `u256` from @btc-vision/as-bignum (big-endian)
 *  - Any built-in integer type (i32, u32, i64, etc.) also stored big-endian
 */
export class NumericCodec<T> implements ICodec<T> {
    public encode(value: T): Uint8Array {
        const id = idof<T>();
        switch (id) {
            case idOfU256: {
                // T is `u256`
                const val = changetype<u256>(value);
                return val.toUint8Array(true); // big-endian
            }
            case idOfU128: {
                // T is `u128`
                const val = changetype<u128>(value);
                return val.toUint8Array(true); // big-endian
            }
            case idOfI128: {
                // T is `i128`
                const val = changetype<i128>(value);
                return val.toUint8Array(true); // big-endian
            }
            default: {
                const writer = new BytesWriter(sizeof<T>());
                writer.write<T>(value);

                return writer.getBuffer();
            }
        }
    }

    public decode(buffer: Uint8Array): T {
        const id = idof<T>();
        switch (id) {
            case idOfU256:
                // T is `u256`
                return changetype<T>(u256.fromBytes(buffer, true));
            case idOfU128:
                // T is `u128`
                return changetype<T>(u128.fromBytes(buffer, true));
            case idOfI128:
                // T is `i128`
                return changetype<T>(i128.fromBytes(buffer, true));
            default: {
                const writer = new BytesReader(buffer);
                return writer.read<T>();
            }
        }
    }
}