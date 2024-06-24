import { NetEvent } from '../../btc/events/NetEvent';
import { BytesWriter } from '../../btc/buffer/BytesWriter';
import { u256 } from 'as-bignum/assembly';
import { Address } from '../../btc/types/Address';

export class ApproveEvent extends NetEvent {
    constructor(owner: Address, spender: Address, value: u256) {
        const data: BytesWriter = new BytesWriter(1, true);
        data.writeAddress(owner);
        data.writeAddress(spender);
        data.writeU256(value);

        super('Approve', data);
    }
}
