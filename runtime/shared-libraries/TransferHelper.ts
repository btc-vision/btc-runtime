import { u256 } from '@btc-vision/as-bignum/assembly';
import { encodeSelector, Selector } from '../math/abi';
import { Address } from '../types/Address';

export const TransferStr = 'transfer(address,uint256)';
export const ApproveStr = 'approve(address,uint256)';
export const TransferFromStr = 'transferFrom(address,address,uint256)';

export class TransferHelper {
    public static safeTransferCalled: boolean = false;
    public static safeTransferFromCalled: boolean = false;

    public static get APPROVE_SELECTOR(): Selector {
        return encodeSelector(ApproveStr);
    }

    public static get TRANSFER_SELECTOR(): Selector {
        return encodeSelector(TransferStr);
    }

    public static get TRANSFER_FROM_SELECTOR(): Selector {
        return encodeSelector(TransferFromStr);
    }

    public static clearMockedResults(): void {
        this.safeTransferCalled = false;
        this.safeTransferFromCalled = false;
    }

    public static safeApprove(token: Address, spender: Address, amount: u256): void {
        /*const calldata = new BytesWriter(
            SELECTOR_BYTE_LENGTH + ADDRESS_BYTE_LENGTH + U256_BYTE_LENGTH,
        );
        calldata.writeSelector(this.APPROVE_SELECTOR);
        calldata.writeAddress(spender);
        calldata.writeU256(amount);

        const response = Blockchain.call(token, calldata);
        const isOk = response.readBoolean();

        if (!isOk) {
            throw new Revert(`TransferHelper: APPROVE_FAILED`);
        }*/
    }

    public static safeTransfer(token: Address, to: Address, amount: u256): void {
        /*const calldata = new BytesWriter(
            SELECTOR_BYTE_LENGTH + ADDRESS_BYTE_LENGTH + U256_BYTE_LENGTH,
        );
        calldata.writeSelector(this.TRANSFER_SELECTOR);
        calldata.writeAddress(to);
        calldata.writeU256(amount);

        const response = Blockchain.call(token, calldata);
        const isOk = response.readBoolean();

        if (!isOk) {
            throw new Revert(`TransferHelper: TRANSFER_FAILED`);
        }*/
        this.safeTransferCalled = true;
    }

    public static safeTransferFrom(token: Address, from: Address, to: Address, amount: u256): void {
        /*const calldata = new BytesWriter(
            SELECTOR_BYTE_LENGTH + ADDRESS_BYTE_LENGTH * 2 + U256_BYTE_LENGTH,
        );

        calldata.writeSelector(this.TRANSFER_FROM_SELECTOR);
        calldata.writeAddress(from);
        calldata.writeAddress(to);
        calldata.writeU256(amount);

        const response = Blockchain.call(token, calldata);
        const isOk = response.readBoolean();

        if (!isOk) {
            throw new Revert(`TransferHelper: TRANSFER_FROM_FAILED`);
        }*/
        this.safeTransferFromCalled = true;
    }
}
