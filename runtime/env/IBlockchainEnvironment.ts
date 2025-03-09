import { Address } from '../types/Address';
import { Block } from './classes/Block';
import { Transaction } from './classes/Transaction';
import { DeployContractResponse } from '../interfaces/DeployContractResponse';
import { BytesWriter } from '../buffer/BytesWriter';
import { BytesReader } from '../buffer/BytesReader';
import { NetEvent } from '../events/NetEvent';
import { u256 } from '@btc-vision/as-bignum/assembly';
import { MemorySlotPointer } from '../memory/MemorySlotPointer';
import { MemorySlotData } from '../memory/MemorySlot';

export interface IBlockchainEnvironment {
    // Read-only constants/properties
    readonly DEAD_ADDRESS: Address;

    readonly block: Block;

    readonly  tx: Transaction;

    //get contract(): OP_NET;
    //set contract(contract: () => OP_NET);

    readonly  nextPointer: u16;

    readonly  contractDeployer: Address;

    readonly  contractAddress: Address;

    setEnvironment(data: Uint8Array): void;

    call(destinationContract: Address, calldata: BytesWriter): BytesReader;

    log(data: string): void;

    emit(event: NetEvent): void;

    validateBitcoinAddress(address: string): bool;

    encodeVirtualAddress(virtualAddress: u8[]): Address;

    deployContractFromExisting(
        existingAddress: Address,
        salt: u256,
    ): DeployContractResponse;

    getStorageAt(
        pointerHash: MemorySlotPointer,
        defaultValue: MemorySlotData<u256>,
    ): MemorySlotData<u256>;

    verifySchnorrSignature(
        publicKey: Address,
        signature: Uint8Array,
        hash: Uint8Array,
    ): boolean;

    hasStorageAt(pointerHash: MemorySlotPointer): bool;

    setStorageAt(
        pointerHash: MemorySlotPointer,
        value: MemorySlotData<u256>,
    ): void;
}

export interface IMockableBlockchainEnvironment extends IBlockchainEnvironment {
    clearMockedResults(): void;

    mockCallResult(result: Uint8Array): void;

    mockValidateBitcoinAddressResult(result: bool): void;

    mockEncodeVirtualAddressResult(result: Address): void;

    mockDeployContractResponse(result: DeployContractResponse): void;

    mockVerifySchnorrSignature(result: bool): void;
}
