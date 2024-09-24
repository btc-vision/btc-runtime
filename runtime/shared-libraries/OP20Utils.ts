import { Address, ADDRESS_BYTE_LENGTH } from '../types/Address';
import { u256 } from 'as-bignum/assembly';
import { BytesWriter } from '../buffer/BytesWriter';
import { Blockchain } from '../env';
import { encodeSelector, Selector } from '../math/abi';

export class OP20Utils {
    public static get BALANCE_OF_SELECTOR(): Selector {
        return encodeSelector('balanceOf');
    }

    public static balanceOf(token: Address, owner: Address): u256 {
        const calldata: BytesWriter = new BytesWriter(4 + ADDRESS_BYTE_LENGTH);
        calldata.writeSelector(OP20Utils.BALANCE_OF_SELECTOR);
        calldata.writeAddress(owner);

        const response = Blockchain.call(token, calldata);

        return response.readU256();
    }
}
