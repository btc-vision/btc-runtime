import { u256 } from 'as-bignum/assembly';
import { BytesWriter } from '../../buffer/BytesWriter';
import { Address } from '../../types/Address';
import { NetEvent } from '../NetEvent';

@final
export class MintEvent extends NetEvent {
    constructor(address: Address, amount: u256) {
        const data: BytesWriter = new BytesWriter(1, true);
        data.writeAddress(address);
        data.writeU256(amount);

        super('Mint', data);
    }
}
