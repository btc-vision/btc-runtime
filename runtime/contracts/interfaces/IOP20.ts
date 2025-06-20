import { BytesWriter } from '../../buffer/BytesWriter';
import { Calldata } from '../../types';

export interface IOP20 {
    domainSeparator(callData: Calldata): BytesWriter;
    balanceOf(callData: Calldata): BytesWriter;
    nonceOf(callData: Calldata): BytesWriter;
    allowance(callData: Calldata): BytesWriter;
    safeTransfer(callData: Calldata): BytesWriter;
    safeTransferFrom(callData: Calldata): BytesWriter;
    increaseAllowance(callData: Calldata): BytesWriter;
    decreaseAllowance(callData: Calldata): BytesWriter;
    increaseAllowanceBySignature(callData: Calldata): BytesWriter;
    decreaseAllowanceBySignature(callData: Calldata): BytesWriter;
}
