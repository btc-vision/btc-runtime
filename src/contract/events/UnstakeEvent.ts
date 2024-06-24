import { NetEvent } from '../../btc/events/NetEvent';
import { BytesWriter } from '../../btc/buffer/BytesWriter';
import { u256 } from 'as-bignum/assembly';

export class UnstakeEvent extends NetEvent {
    constructor(amount: u256) {
        const data: BytesWriter = new BytesWriter(1, true);
        data.writeU256(amount);

        super('Unstake', data);
    }
}
