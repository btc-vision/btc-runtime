import { NetEvent } from '../../btc/events/NetEvent';
import { BytesWriter } from '../../btc/buffer/BytesWriter';
import { Address } from '../../btc/types/Address';
import { u256 } from 'as-bignum/assembly';

export class MintEvent extends NetEvent {
    constructor(address: Address, amount: u256) {
        const data: BytesWriter = new BytesWriter(1, true);
        data.writeAddress(address);
        data.writeU256(amount);

        super('Mint', data);
    }
}
