import { u256 } from 'as-bignum/assembly';
import { BytesWriter } from '../../buffer/BytesWriter';
import { Address } from '../../types/Address';
import { NetEvent } from '../NetEvent';

@final
export class TransferEvent extends NetEvent {
    constructor(from: Address, to: Address, amount: u256) {
        const data: BytesWriter = new BytesWriter(1, true);
        data.writeAddress(from);
        data.writeAddress(to);
        data.writeU256(amount);

        super('Transfer', data);
    }
}
