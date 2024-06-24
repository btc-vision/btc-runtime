import { NetEvent } from '../../btc/events/NetEvent';
import { BytesWriter } from '../../btc/buffer/BytesWriter';
import { Address } from '../../btc/types/Address';
import { u256 } from 'as-bignum/assembly';

export class TransferEvent extends NetEvent {
    constructor(from: Address, to: Address, amount: u256) {
        const data: BytesWriter = new BytesWriter(1, true);
        data.writeAddress(from);
        data.writeAddress(to);
        data.writeU256(amount);

        super('Transfer', data);
    }
}
