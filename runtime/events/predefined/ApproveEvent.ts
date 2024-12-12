import { u256 } from '@btc-vision/as-bignum/assembly';
import { Address, ADDRESS_BYTE_LENGTH } from '../../types/Address';
import { NetEvent } from '../NetEvent';
import { BytesWriter } from '../../buffer/BytesWriter';

@final
export class ApproveEvent extends NetEvent {
    constructor(owner: Address, spender: Address, value: u256) {
        const data: BytesWriter = new BytesWriter(ADDRESS_BYTE_LENGTH * 2 + 32);
        data.writeAddress(owner);
        data.writeAddress(spender);
        data.writeU256(value);

        super('Approve', data);
    }
}
