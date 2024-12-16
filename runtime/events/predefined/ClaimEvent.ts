import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesWriter } from '../../buffer/BytesWriter';
import { U256_BYTE_LENGTH } from '../../utils/lengths';
import { NetEvent } from '../NetEvent';

@final
export class ClaimEvent extends NetEvent {
    constructor(amount: u256) {
        const data: BytesWriter = new BytesWriter(U256_BYTE_LENGTH);
        data.writeU256(amount);

        super('Claim', data);
    }
}
