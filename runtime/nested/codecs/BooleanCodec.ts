import { ICodec } from '../interfaces/ICodec';

class _BooleanCodec implements ICodec<bool> {
    public encode(value: bool): Uint8Array {
        const out = new Uint8Array(1);
        out[0] = value ? 1 : 0;
        return out;
    }

    public decode(buffer: Uint8Array): bool {
        if (buffer.length == 0) return false;
        return buffer[0] == 1;
    }
}

export const idOfBoolCodec = idof<_BooleanCodec>();
export const BooleanCodec = new _BooleanCodec();