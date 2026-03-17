import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesWriter } from '../../buffer/BytesWriter';
import { Address } from '../../types/Address';
import { ADDRESS_BYTE_LENGTH, U256_BYTE_LENGTH } from '../../utils';
import { NetEvent } from '../NetEvent';

@final
export class OP721ApprovedEvent extends NetEvent {
    constructor(owner: Address, operator: Address, tokenId: u256) {
        const data: BytesWriter = new BytesWriter(ADDRESS_BYTE_LENGTH * 2 + U256_BYTE_LENGTH);
        data.writeAddress(owner);
        data.writeAddress(operator);
        data.writeU256(tokenId);

        super('Approved', data);
    }
}
