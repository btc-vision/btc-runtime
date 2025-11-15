import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesWriter } from '../buffer/BytesWriter';
import { Blockchain } from '../env';
import { encodeSelector, Selector } from '../math/abi';
import { Address } from '../types/Address';
import {
    ADDRESS_BYTE_LENGTH,
    SELECTOR_BYTE_LENGTH,
    U256_BYTE_LENGTH,
    U32_BYTE_LENGTH,
} from '../utils';

export const transferSignature = 'transfer(address,uint256)';
export const transferFromSignature = 'transferFrom(address,address,uint256)';
export const SafeTransferSignature = 'safeTransfer(address,uint256,bytes)';
export const SafeTransferFromSignature = 'safeTransferFrom(address,address,uint256,bytes)';
export const IncreaseAllowanceSignature = 'increaseAllowance(address,uint256)';
export const DecreaseAllowanceSignature = 'decreaseAllowance(address,uint256)';
export const BurnSignature = 'burn(uint256)';

export class TransferHelper {
    public static get INCREASE_ALLOWANCE_SELECTOR(): Selector {
        return encodeSelector(IncreaseAllowanceSignature);
    }

    public static get DECREASE_ALLOWANCE_SELECTOR(): Selector {
        return encodeSelector(DecreaseAllowanceSignature);
    }

    public static get TRANSFER_SELECTOR(): Selector {
        return encodeSelector(transferSignature);
    }

    public static get TRANSFER_FROM_SELECTOR(): Selector {
        return encodeSelector(transferFromSignature);
    }

    public static get SAFE_TRANSFER_SELECTOR(): Selector {
        return encodeSelector(SafeTransferSignature);
    }

    public static get SAFE_TRANSFER_FROM_SELECTOR(): Selector {
        return encodeSelector(SafeTransferFromSignature);
    }

    public static increaseAllowance(token: Address, spender: Address, amount: u256): void {
        const calldata = new BytesWriter(
            SELECTOR_BYTE_LENGTH + ADDRESS_BYTE_LENGTH + U256_BYTE_LENGTH,
        );
        calldata.writeSelector(this.INCREASE_ALLOWANCE_SELECTOR);
        calldata.writeAddress(spender);
        calldata.writeU256(amount);

        Blockchain.call(token, calldata);
    }

    public static decreaseAllowance(token: Address, spender: Address, amount: u256): void {
        const calldata = new BytesWriter(
            SELECTOR_BYTE_LENGTH + ADDRESS_BYTE_LENGTH + U256_BYTE_LENGTH,
        );
        calldata.writeSelector(this.DECREASE_ALLOWANCE_SELECTOR);
        calldata.writeAddress(spender);
        calldata.writeU256(amount);

        Blockchain.call(token, calldata);
    }

    public static transfer(token: Address, to: Address, amount: u256): void {
        const calldata = new BytesWriter(
            SELECTOR_BYTE_LENGTH + ADDRESS_BYTE_LENGTH + U256_BYTE_LENGTH,
        );
        calldata.writeSelector(this.TRANSFER_SELECTOR);
        calldata.writeAddress(to);
        calldata.writeU256(amount);

        Blockchain.call(token, calldata);
    }

    public static transferFrom(token: Address, from: Address, to: Address, amount: u256): void {
        const calldata = new BytesWriter(
            SELECTOR_BYTE_LENGTH + ADDRESS_BYTE_LENGTH * 2 + U256_BYTE_LENGTH,
        );
        calldata.writeSelector(this.TRANSFER_FROM_SELECTOR);
        calldata.writeAddress(from);
        calldata.writeAddress(to);
        calldata.writeU256(amount);

        Blockchain.call(token, calldata);
    }

    public static safeTransfer(
        token: Address,
        to: Address,
        amount: u256,
        data: Uint8Array = new Uint8Array(0),
    ): void {
        const calldata = new BytesWriter(
            SELECTOR_BYTE_LENGTH +
                ADDRESS_BYTE_LENGTH +
                U256_BYTE_LENGTH +
                U32_BYTE_LENGTH +
                data.length,
        );
        calldata.writeSelector(this.SAFE_TRANSFER_SELECTOR);
        calldata.writeAddress(to);
        calldata.writeU256(amount);
        calldata.writeBytesWithLength(data);

        Blockchain.call(token, calldata);
    }

    /**
     * Burns the specified amount of tokens from the contract.
     * This function is used to destroy tokens, reducing the total supply.
     * @param token The address of the token contract.
     * @param amount The amount of tokens to burn.
     */
    public static burn(token: Address, amount: u256): void {
        const calldata = new BytesWriter(SELECTOR_BYTE_LENGTH + U256_BYTE_LENGTH);
        calldata.writeSelector(encodeSelector(BurnSignature));
        calldata.writeU256(amount);

        Blockchain.call(token, calldata);
    }

    public static safeTransferFrom(
        token: Address,
        from: Address,
        to: Address,
        amount: u256,
        data: Uint8Array = new Uint8Array(0),
    ): void {
        const calldata = new BytesWriter(
            SELECTOR_BYTE_LENGTH +
                ADDRESS_BYTE_LENGTH * 2 +
                U256_BYTE_LENGTH +
                U32_BYTE_LENGTH +
                data.length,
        );
        calldata.writeSelector(this.SAFE_TRANSFER_FROM_SELECTOR);
        calldata.writeAddress(from);
        calldata.writeAddress(to);
        calldata.writeU256(amount);
        calldata.writeBytesWithLength(data);

        Blockchain.call(token, calldata);
    }
}
