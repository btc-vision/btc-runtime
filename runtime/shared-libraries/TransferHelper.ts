import { u256 } from 'as-bignum/assembly/integer/u256';
import { encodeSelector, Selector } from '../math/abi';
import { Address } from '../types/Address';
import { BytesWriter } from '../buffer/BytesWriter';
import { Blockchain } from '../env';
import { Revert } from '../types/Revert';

export class TransferHelper {
    public static get APPROVE_SELECTOR(): Selector {
        return encodeSelector('approve');
    }

    public static get TRANSFER_SELECTOR(): Selector {
        return encodeSelector('transfer');
    }

    public static get TRANSFER_FROM_SELECTOR(): Selector {
        return encodeSelector('transferFrom');
    }

    public static safeApprove(token: Address, spender: Address, amount: u256): void {
        const calldata = new BytesWriter();
        calldata.writeSelector(this.APPROVE_SELECTOR);
        calldata.writeAddress(spender);
        calldata.writeU256(amount);

        const response = Blockchain.call(token, calldata);
        const isOk = response.readBoolean();

        if (!isOk) {
            throw new Revert(`TransferHelper: APPROVE_FAILED`);
        }
    }

    public static safeTransfer(token: Address, to: Address, amount: u256): void {
        const calldata = new BytesWriter();
        calldata.writeSelector(this.TRANSFER_SELECTOR);
        calldata.writeAddress(to);
        calldata.writeU256(amount);

        const response = Blockchain.call(token, calldata);
        const isOk = response.readBoolean();

        if (!isOk) {
            throw new Revert(`TransferHelper: TRANSFER_FAILED`);
        }
    }

    public static safeTransferFrom(token: Address, from: Address, to: Address, amount: u256): void {
        const calldata = new BytesWriter();
        calldata.writeSelector(this.TRANSFER_FROM_SELECTOR);

        calldata.writeAddress(from);
        calldata.writeAddress(to);
        calldata.writeU256(amount);

        const response = Blockchain.call(token, calldata);
        const isOk = response.readBoolean();

        if (!isOk) {
            throw new Revert(`TransferHelper: TRANSFER_FROM_FAILED`);
        }
    }
}
