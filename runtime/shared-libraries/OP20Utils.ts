import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesWriter } from '../buffer/BytesWriter';
import { Blockchain } from '../env';
import { encodeSelector, Selector } from '../math/abi';
import { Address } from '../types/Address';
import { ADDRESS_BYTE_LENGTH, SELECTOR_BYTE_LENGTH } from '../utils';

export class OP20Utils {
    public static get BALANCE_OF_SELECTOR(): Selector {
        return encodeSelector('balanceOf(address)');
    }

    public static balanceOf(token: Address, owner: Address): u256 {
        const calldata: BytesWriter = new BytesWriter(SELECTOR_BYTE_LENGTH + ADDRESS_BYTE_LENGTH);
        calldata.writeSelector(OP20Utils.BALANCE_OF_SELECTOR);
        calldata.writeAddress(owner);

        const response = Blockchain.call(token, calldata);
        return response.data.readU256();
    }
}
