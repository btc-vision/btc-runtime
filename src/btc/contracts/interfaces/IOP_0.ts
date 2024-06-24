import { BytesWriter } from '../../buffer/BytesWriter';
import { Calldata } from '../../universal/ABIRegistry';
import { StoredU256 } from '../../storage/StoredU256';

export interface IOP_0 {
    readonly name: string;
    readonly symbol: string;

    readonly decimals: u8;
    readonly _totalSupply: StoredU256;

    balanceOf(callData: Calldata): BytesWriter;

    transfer(callData: Calldata): BytesWriter;

    transferFrom(callData: Calldata): BytesWriter;

    approve(callData: Calldata): BytesWriter;

    allowance(callData: Calldata): BytesWriter;

    burn(callData: Calldata): BytesWriter;

    mint(callData: Calldata): BytesWriter;
}
