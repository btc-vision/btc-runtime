import { BytesWriter } from '../../buffer/BytesWriter';
import { Calldata } from '../../types';

export interface IOP1155 {
    // Core properties
    fn_name(calldata: Calldata): BytesWriter;
    fn_symbol(calldata: Calldata): BytesWriter;
    uri(calldata: Calldata): BytesWriter;

    // Balance and supply
    balanceOf(calldata: Calldata): BytesWriter;
    balanceOfBatch(calldata: Calldata): BytesWriter;
    totalSupply(calldata: Calldata): BytesWriter;
    exists(calldata: Calldata): BytesWriter;

    // Transfer functions
    safeTransferFrom(calldata: Calldata): BytesWriter;
    safeBatchTransferFrom(calldata: Calldata): BytesWriter;

    // Approval functions
    setApprovalForAll(calldata: Calldata): BytesWriter;
    isApprovedForAll(calldata: Calldata): BytesWriter;

    // Advanced functions
    burn(calldata: Calldata): BytesWriter;
    burnBatch(calldata: Calldata): BytesWriter;
    transferBySignature(calldata: Calldata): BytesWriter;
    batchTransferBySignature(calldata: Calldata): BytesWriter;
    domainSeparator(calldata: Calldata): BytesWriter;

    // Interface support
    supportsInterface(calldata: Calldata): BytesWriter;
}
