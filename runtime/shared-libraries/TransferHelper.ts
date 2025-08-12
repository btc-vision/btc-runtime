import { u256 } from '@btc-vision/as-bignum/assembly';
import { encodeSelector, Selector } from '../math/abi';
import { Address } from '../types/Address';
import {
    ADDRESS_BYTE_LENGTH,
    SELECTOR_BYTE_LENGTH,
    U256_BYTE_LENGTH,
    U32_BYTE_LENGTH,
} from '../utils';

export const SafeTransferSignature = 'safeTransfer(address,uint256,bytes)';
export const SafeTransferFromSignature = 'safeTransferFrom(address,address,uint256,bytes)';
export const IncreaseAllowanceSignature = 'increaseAllowance(address,uint256)';
export const DecreaseAllowanceSignature = 'decreaseAllowance(address,uint256)';
export const BurnSignature = 'burn(uint256)';

export class TransferHelper {
    public static safeTransferCalled: boolean = false;
    public static calledBurn: boolean = false;
    public static safeTransferFromCalled: boolean = false;

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

    public static clearMockedResults(): void {
        this.safeTransferCalled = false;
        this.safeTransferFromCalled = false;
    }

    public static safeTransfer(token: Address, to: Address, amount: u256, data: Uint8Array = new Uint8Array(0)): void {
        this.safeTransferCalled = true;
    }

    /**
     * Burns the specified amount of tokens from the contract.
     * This function is used to destroy tokens, reducing the total supply.
     * @param token The address of the token contract.
     * @param amount The amount of tokens to burn.
     */
    public static burn(token: Address, amount: u256): void {
        this.calledBurn = true;
    }

    public static safeTransferFrom(token: Address, from: Address, to: Address, amount: u256, data: Uint8Array = new Uint8Array(0)): void {
        this.safeTransferFromCalled = true;
    }
}
