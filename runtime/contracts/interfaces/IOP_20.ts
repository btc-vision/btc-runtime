import { BytesWriter } from '../../buffer/BytesWriter';
import { StoredU256 } from '../../storage/StoredU256';
import { Calldata } from '../../types';

export interface IOP_20 {
    readonly _totalSupply: StoredU256;

    balanceOf(callData: Calldata): BytesWriter;

    transfer(callData: Calldata): BytesWriter;

    transferFrom(callData: Calldata): BytesWriter;

    increaseAllowance(callData: Calldata): BytesWriter;

    decreaseAllowance(callData: Calldata): BytesWriter;

    allowance(callData: Calldata): BytesWriter;

    burn(callData: Calldata): BytesWriter;
}
