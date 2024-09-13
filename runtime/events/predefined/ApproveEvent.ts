import { u256 } from 'as-bignum/assembly';
import { BytesWriter } from '../../buffer/BytesWriter';
import { Address } from '../../types/Address';
import { NetEvent } from '../NetEvent';

@final
export class ApproveEvent extends NetEvent {
    constructor(owner: Address, spender: Address, value: u256) {
        const data: BytesWriter = new BytesWriter(1, true);
        data.writeAddress(owner);
        data.writeAddress(spender);
        data.writeU256(value);

        super('Approve', data);
    }
}
