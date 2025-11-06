import { BytesWriter } from '../../buffer/BytesWriter';
import { Calldata } from '../../types';

export interface IOP20 {
    name(callData: Calldata): BytesWriter;
    symbol(callData: Calldata): BytesWriter;
    icon(callData: Calldata): BytesWriter;
    decimals(callData: Calldata): BytesWriter;
    totalSupply(callData: Calldata): BytesWriter;
    domainSeparator(callData: Calldata): BytesWriter;
    metadata(callData: Calldata): BytesWriter;
    balanceOf(callData: Calldata): BytesWriter;
    nonceOf(callData: Calldata): BytesWriter;
    allowance(callData: Calldata): BytesWriter;
    safeTransfer(callData: Calldata): BytesWriter;
    safeTransferFrom(callData: Calldata): BytesWriter;
    transfer(callData: Calldata): BytesWriter;
    transferFrom(callData: Calldata): BytesWriter;
    burn(callData: Calldata): BytesWriter;
    increaseAllowance(callData: Calldata): BytesWriter;
    decreaseAllowance(callData: Calldata): BytesWriter;
    increaseAllowanceBySignature(callData: Calldata): BytesWriter;
    decreaseAllowanceBySignature(callData: Calldata): BytesWriter;
}
