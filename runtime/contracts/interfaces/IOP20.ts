import { BytesWriter } from '../../buffer/BytesWriter';
import { StoredU256 } from '../../storage/StoredU256';
import { Calldata } from '../../types';

export interface IOP20 {
    readonly _totalSupply: StoredU256;

    balanceOf(callData: Calldata): BytesWriter;

    safeTransfer(callData: Calldata): BytesWriter;

    safeTransferFrom(callData: Calldata): BytesWriter;

    increaseAllowance(callData: Calldata): BytesWriter;

    decreaseAllowance(callData: Calldata): BytesWriter;

    allowance(callData: Calldata): BytesWriter;

    burn(callData: Calldata): BytesWriter;
}
