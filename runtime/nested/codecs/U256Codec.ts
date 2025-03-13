import { u256 } from '@btc-vision/as-bignum/assembly';
import { ICodec } from '../interfaces/ICodec';

class _U256Codec implements ICodec<u256> {
    public encode(value: u256): Uint8Array {
        // big-endian
        return value.toUint8Array(true);
    }

    public decode(buffer: Uint8Array): u256 {
        if (buffer.length == 0) {
            return u256.Zero;
        }

        return u256.fromUint8ArrayBE(buffer);
    }
}

export const idOfU256Codec = idof<_U256Codec>();
export const U256Codec = new _U256Codec();
