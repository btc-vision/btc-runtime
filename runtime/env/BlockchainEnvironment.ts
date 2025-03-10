import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesReader } from '../buffer/BytesReader';
import { BytesWriter } from '../buffer/BytesWriter';
import { OP_NET } from '../contracts/OP_NET';
import { NetEvent } from '../events/NetEvent';
import { MapU256 } from '../generic/MapU256';
import { DeployContractResponse } from '../interfaces/DeployContractResponse';
import { Potential } from '../lang/Definitions';
import { MemorySlotData } from '../memory/MemorySlot';
import { MemorySlotPointer } from '../memory/MemorySlotPointer';
import { PointerStorage } from '../types';
import { Address } from '../types/Address';
import { Block } from './classes/Block';
import { Transaction } from './classes/Transaction';
import { TransactionOutput } from './classes/UTXO';
import { Revert } from '../types/Revert';

export * from '../env/global';

export function runtimeError(msg: string): Error {
    return new Error(`RuntimeException: ${msg}`);
}

/**
 * Logs a single value to the logger, and is stringified. It works for references, values, and
 * strings.
 *
 * @type {T} - The type to be logged.
 * @param {T | null} value - The value to be logged.
 *
 * @example
 *
 * ```ts
 * log<string>("This is a logged value.");
 * log<i32>(42);
 * log<Vec3>(new Vec(1, 2, 3));
 * log<Vec3>(null);
 * ```
 */
declare function log<T>(value: T | null): void;

@final
export class BlockchainEnvironment {
    private static readonly MAX_U16: u16 = 65535;

    public readonly DEAD_ADDRESS: Address = Address.dead();

    public storage: PointerStorage = new MapU256();
    private _selfContract: Potential<OP_NET> = null;
    private _mockedCallResult: Uint8Array = new Uint8Array(1);
    private _mockedValidateBitcoinAddressResult: bool = false;
    private _mockedEncodeVirtualAddressResult: Address = new Address();
    private _mockedDeployContractResponse: DeployContractResponse = new DeployContractResponse(
        u256.Zero,
        new Address(),
    );
    private _mockedVerifySchnorrSignature: boolean = false;
    private _mockedOutputs: TransactionOutput[] = [];

    private _block: Potential<Block> = null;

    @inline
    public get block(): Block {
        if (!this._block) {
            throw this.error('Block is required');
        }

        return this._block as Block;
    }

    private _tx: Potential<Transaction> = null;

    @inline
    public get tx(): Transaction {
        if (!this._tx) {
            throw this.error('Transaction is required');
        }

        return this._tx as Transaction;
    }

    private _contract: Potential<() => OP_NET> = null;

    public get contract(): OP_NET {
        this.createContractIfNotExists();

        return this._selfContract as OP_NET;
    }

    public set contract(contract: () => OP_NET) {
        this._contract = contract;
    }

    private _nextPointer: u16 = 0;

    public get nextPointer(): u16 {
        if (this._nextPointer === BlockchainEnvironment.MAX_U16) {
            throw this.error(`Out of storage pointer.`);
        }

        this._nextPointer += 1;

        return this._nextPointer;
    }

    public _contractDeployer: Potential<Address> = null;

    public get contractDeployer(): Address {
        if (!this._contractDeployer) {
            throw this.error('Deployer is required');
        }

        return this._contractDeployer as Address;
    }

    public _contractAddress: Potential<Address> = null;

    public get contractAddress(): Address {
        if (!this._contractAddress) {
            throw this.error('Contract address is required');
        }

        return this._contractAddress as Address;
    }

    public clearMockedResults(): void {
        this._mockedCallResult = new Uint8Array(1);
        this._mockedValidateBitcoinAddressResult = false;
        this._mockedEncodeVirtualAddressResult = new Address();
        this._mockedDeployContractResponse = new DeployContractResponse(u256.Zero, new Address());
        this._mockedVerifySchnorrSignature = false;
        this._mockedOutputs = [];
    }

    public mockCallResult(data: Uint8Array): void {
        this._mockedCallResult = data;
    }

    public mockValidateBitcoinAddressResult(result: bool): void {
        this._mockedValidateBitcoinAddressResult = result;
    }

    public mockEncodeVirtualAddressResult(result: Address): void {
        this._mockedEncodeVirtualAddressResult = result;
    }

    public mockDeployContractResponse(result: DeployContractResponse): void {
        this._mockedDeployContractResponse = result;
    }

    public mockVerifySchnorrSignature(result: boolean): void {
        this._mockedVerifySchnorrSignature = result;
    }

    public mockTransactionOutput(transactions: TransactionOutput[]): void {
        this._mockedOutputs = transactions;
    }

    public mockedTransactionOutput(): Uint8Array {
        if (this._mockedOutputs.length > 250) {
            throw new Revert(`Out of storage pointer.`);
        }

        const writer = new BytesWriter(this._mockedOutputs.length * (1 + 2 + 64 + 8) + 1);
        writer.writeU8(u8(this._mockedOutputs.length));

        for (let i = 0; i < this._mockedOutputs.length; i++) {
            const output = this._mockedOutputs[i];

            writer.writeU8(output.index);
            writer.writeStringWithLength(output.to);
            writer.writeU64(output.value);
        }

        return writer.getBuffer();
    }

    public clearStorage(): void {
        this.storage.clear();
    }

    public setEnvironment(data: Uint8Array): void {
        const reader: BytesReader = new BytesReader(data);

        this._tx = new Transaction(
            reader.readAddress(),
            reader.readAddress(),
            reader.readBytes(32),
            true
        );

        const currentBlock = reader.readU256();

        this._contractDeployer = reader.readAddress();
        this._contractAddress = reader.readAddress();

        const medianTimestamp = reader.readU64();
        const safeRnd64 = reader.readU64();

        this._block = new Block(currentBlock, medianTimestamp, safeRnd64);

        //this.createContractIfNotExists();
    }

    public call(destinationContract: Address, calldata: BytesWriter): BytesReader {
        if (destinationContract === this.contractAddress) {
            throw this.error('Cannot call self');
        }

        if (!destinationContract) {
            throw this.error('Destination contract is required');
        }

        return new BytesReader(this._mockedCallResult);
    }

    public log(data: string): void {
        log(data);
    }

    public emit(event: NetEvent): void {
        /*const data = event.getEventData();
        const buffer = new BytesWriter(event.eventType.length + 6 + data.byteLength);

        buffer.writeStringWithLength(event.eventType);
        buffer.writeBytesWithLength(data);

        emit(buffer.getBuffer());*/
    }

    public validateBitcoinAddress(address: string): bool {
        return this._mockedValidateBitcoinAddressResult;
    }

    public encodeVirtualAddress(virtualAddress: u8[]): Address {
        return this._mockedEncodeVirtualAddressResult;
    }

    /*public deployContract(hash: u256, bytecode: Uint8Array): DeployContractResponse {
        const writer = new BytesWriter(U256_BYTE_LENGTH + bytecode.length);
        writer.writeU256(hash);
        writer.writeBytes(bytecode);

        const cb: Potential<Uint8Array> = deploy(writer.getBuffer());
        if (!cb) throw this.error('Failed to deploy contract');

        const reader: BytesReader = new BytesReader(cb as Uint8Array);
        const virtualAddress: u256 = reader.readU256();
        const contractAddress: Address = reader.readAddress();

        return new DeployContractResponse(virtualAddress, contractAddress);
    }*/

    public deployContractFromExisting(
        existingAddress: Address,
        salt: u256,
    ): DeployContractResponse {
        return this._mockedDeployContractResponse;
    }

    // TODO: Change MemorySlotData type to a Uint8Array instead of a u256.
    public getStorageAt(
        pointerHash: MemorySlotPointer,
        defaultValue: MemorySlotData<u256>,
    ): MemorySlotData<u256> {
        this.ensureStorageAtPointer(pointerHash, defaultValue);

        if (this.storage.has(pointerHash)) {
            return this.storage.get(pointerHash);
        }

        return defaultValue;
    }

    /*public getNextPointerGreaterThan(
        targetPointer: MemorySlotPointer,
        valueAtLeast: u256,
        lte: boolean = true,
    ): MemorySlotData<u256> {
        const writer = new BytesWriter(U256_BYTE_LENGTH * 2 + BOOLEAN_BYTE_LENGTH);
        writer.writeU256(targetPointer);
        writer.writeU256(valueAtLeast);
        writer.writeBoolean(lte);

        const result: Uint8Array = nextPointerGreaterThan(writer.getBuffer());
        const reader: BytesReader = new BytesReader(result);

        return reader.readU256();
    }*/

    public verifySchnorrSignature(
        publicKey: Address,
        signature: Uint8Array,
        hash: Uint8Array,
    ): boolean {
        return this._mockedVerifySchnorrSignature;
    }

    // TODO: Change MemorySlotData type to a Uint8Array instead of a u256.
    public hasStorageAt(pointerHash: MemorySlotPointer): bool {
        // We mark zero as the default value for the storage, if something is 0, the storage slot get deleted or is non-existent
        const val: u256 = this.getStorageAt(pointerHash, u256.Zero);

        return u256.ne(val, u256.Zero);
    }

    public setStorageAt(pointerHash: MemorySlotPointer, value: MemorySlotData<u256>): void {
        this._internalSetStorageAt(pointerHash, value);
    }

    private createContractIfNotExists(): void {
        if (!this._contract) {
            throw this.error('Contract is required');
        }

        if (!this._selfContract) {
            this._selfContract = this._contract();
        }
    }

    private error(msg: string): Error {
        return runtimeError(msg);
    }

    private _internalSetStorageAt(pointerHash: u256, value: MemorySlotData<u256>): void {
        this.storage.set(pointerHash, value);
    }

    private hasPointerStorageHash(pointer: MemorySlotPointer): bool {
        return this.storage.has(pointer);
    }

    private ensureStorageAtPointer(
        pointerHash: MemorySlotPointer,
        defaultValue: MemorySlotData<u256>,
    ): void {
        if (this.hasPointerStorageHash(pointerHash)) {
            return;
        }

        if (u256.eq(defaultValue, u256.Zero)) {
            return;
        }

        this._internalSetStorageAt(pointerHash, defaultValue);
    }
}
