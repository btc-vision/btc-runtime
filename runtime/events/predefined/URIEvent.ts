import { NetEvent } from '../NetEvent';
import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesWriter } from '../../buffer/BytesWriter';
import { U256_BYTE_LENGTH, U32_BYTE_LENGTH } from '../../utils';
import { Revert } from '../../types/Revert';

export const MAX_URI_LENGTH: u32 = 200;

@final
export class URIEvent extends NetEvent {
    constructor(value: string, id: u256) {
        const valueBytes: u32 = u32(String.UTF8.byteLength(value));

        if (valueBytes > MAX_URI_LENGTH) {
            throw new Revert('URI event exceeds max data size');
        }

        const writer = new BytesWriter(U32_BYTE_LENGTH + valueBytes + U256_BYTE_LENGTH);
        writer.writeStringWithLength(value);
        writer.writeU256(id);
        super('URI', writer);
    }
}
