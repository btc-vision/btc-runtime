import { u256 } from 'as-bignum/assembly';
import { NetEvent } from '../NetEvent';
import { BytesWriter } from '../../buffer/BytesWriter';

@final
export class UnstakeEvent extends NetEvent {
    constructor(amount: u256) {
        const data: BytesWriter = new BytesWriter(1, true);
        data.writeU256(amount);

        super('Unstake', data);
    }
}
