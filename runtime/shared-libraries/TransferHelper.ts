import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesWriter } from '../buffer/BytesWriter';
import { Blockchain } from '../env';
import { encodeSelector, Selector } from '../math/abi';
import { Address } from '../types/Address';
import { ADDRESS_BYTE_LENGTH, SELECTOR_BYTE_LENGTH, U256_BYTE_LENGTH } from '../utils';

export const SafeTransferSignature = 'safeTransfer(address,uint256,bytes)';
export const SafeTransferFromSignature = 'safeTransferFrom(address,address,uint256,bytes)';
export const IncreaseAllowanceSignature = 'increaseAllowance(address,uint256)';
export const DecreaseAllowanceSignature = 'decreaseAllowance(address,uint256)';

export class TransferHelper {
    public static get INCREASE_ALLOWANCE_SELECTOR(): Selector {
        return encodeSelector(IncreaseAllowanceSignature);
    }

    public static get DECREASE_ALLOWANCE_SELECTOR(): Selector {
        return encodeSelector(DecreaseAllowanceSignature);
    }

    public static get TRANSFER_SELECTOR(): Selector {
        return encodeSelector(SafeTransferSignature);
    }

    public static get TRANSFER_FROM_SELECTOR(): Selector {
        return encodeSelector(SafeTransferFromSignature);
    }

    public static safeIncreaseAllowance(token: Address, spender: Address, amount: u256): void {
        const calldata = new BytesWriter(
            SELECTOR_BYTE_LENGTH + ADDRESS_BYTE_LENGTH + U256_BYTE_LENGTH,
        );
        calldata.writeSelector(this.INCREASE_ALLOWANCE_SELECTOR);
        calldata.writeAddress(spender);
        calldata.writeU256(amount);

        Blockchain.call(token, calldata);
    }

    public static safeDecreaseAllowance(token: Address, spender: Address, amount: u256): void {
        const calldata = new BytesWriter(
            SELECTOR_BYTE_LENGTH + ADDRESS_BYTE_LENGTH + U256_BYTE_LENGTH,
        );
        calldata.writeSelector(this.DECREASE_ALLOWANCE_SELECTOR);
        calldata.writeAddress(spender);
        calldata.writeU256(amount);

        Blockchain.call(token, calldata);
    }

    public static safeTransfer(token: Address, to: Address, amount: u256, data: Uint8Array = new Uint8Array(0)): void {
        const calldata = new BytesWriter(
            SELECTOR_BYTE_LENGTH + ADDRESS_BYTE_LENGTH + U256_BYTE_LENGTH,
        );
        calldata.writeSelector(this.TRANSFER_SELECTOR);
        calldata.writeAddress(to);
        calldata.writeU256(amount);
        calldata.writeBytesWithLength(data);

        Blockchain.call(token, calldata);
    }

    public static safeTransferFrom(token: Address, from: Address, to: Address, amount: u256, data: Uint8Array = new Uint8Array(0)): void {
        const calldata = new BytesWriter(
            SELECTOR_BYTE_LENGTH + ADDRESS_BYTE_LENGTH * 2 + U256_BYTE_LENGTH,
        );
        calldata.writeSelector(this.TRANSFER_FROM_SELECTOR);
        calldata.writeAddress(from);
        calldata.writeAddress(to);
        calldata.writeU256(amount);
        calldata.writeBytesWithLength(data);

        Blockchain.call(token, calldata);
    }
}
