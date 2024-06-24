import { NetEvent } from '../../btc/events/NetEvent';
import { BytesWriter } from '../../btc/buffer/BytesWriter';
import { u256 } from 'as-bignum/assembly';
import { Address } from '../../btc/types/Address';

export class WithdrawalRequestEvent extends NetEvent {
    constructor(amount: u256, address: Address) {
        const data: BytesWriter = new BytesWriter(1, true);
        data.writeAddress(address);
        data.writeU256(amount);

        super('WithdrawalRequest', data);
    }
}
