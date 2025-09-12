import { BytesWriter } from '../../buffer/BytesWriter';
import { Calldata } from '../../types';

export interface IOP721 {
    // Core NFT properties
    fn_name(calldata: Calldata): BytesWriter;
    fn_symbol(calldata: Calldata): BytesWriter;
    tokenURI(calldata: Calldata): BytesWriter;
    fn_totalSupply(calldata: Calldata): BytesWriter;

    // Balance and ownership
    balanceOf(calldata: Calldata): BytesWriter;
    ownerOf(calldata: Calldata): BytesWriter;

    // Transfer functions
    safeTransfer(calldata: Calldata): BytesWriter;
    safeTransferFrom(calldata: Calldata): BytesWriter;

    // Approval functions
    approve(calldata: Calldata): BytesWriter;
    getApproved(calldata: Calldata): BytesWriter;
    setApprovalForAll(calldata: Calldata): BytesWriter;
    isApprovedForAll(calldata: Calldata): BytesWriter;
    approveBySignature(calldata: Calldata): BytesWriter;
    setApprovalForAllBySignature(calldata: Calldata): BytesWriter;

    // Advanced functions
    burn(calldata: Calldata): BytesWriter;
    domainSeparator(calldata: Calldata): BytesWriter;
}
