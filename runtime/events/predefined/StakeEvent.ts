import { u256 } from 'as-bignum/assembly';
import { BytesWriter } from '../../buffer/BytesWriter';
import { NetEvent } from '../NetEvent';

@final
export class StakeEvent extends NetEvent {
    constructor(amount: u256) {
        const data: BytesWriter = new BytesWriter(1, true);
        data.writeU256(amount);

        super('Stake', data);
    }
}
