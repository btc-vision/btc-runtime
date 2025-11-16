import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesWriter } from '../../buffer/BytesWriter';
import { Address } from '../../types/Address';
import { ADDRESS_BYTE_LENGTH, U256_BYTE_LENGTH } from '../../utils';
import { NetEvent } from '../NetEvent';

@final
export class ApprovedEvent extends NetEvent {
    constructor(owner: Address, spender: Address, amount: u256) {
        const data: BytesWriter = new BytesWriter(ADDRESS_BYTE_LENGTH * 2 + U256_BYTE_LENGTH);
        data.writeAddress(owner);
        data.writeAddress(spender);
        data.writeU256(amount);

        super('Approved', data);
    }
}
