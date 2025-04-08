import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesReader } from '../buffer/BytesReader';
import { BytesWriter } from '../buffer/BytesWriter';
import { OP_NET } from '../contracts/OP_NET';
import { NetEvent } from '../events/NetEvent';
import { Potential } from '../lang/Definitions';
import { Address } from '../types/Address';
import { Block } from './classes/Block';
import { Transaction } from './classes/Transaction';
import { sha256 } from './global';
import { eqUint, MapUint8Array } from '../generic/MapUint8Array';
import { EMPTY_BUFFER } from '../math/bytes';
import { Plugin } from '../plugins/Plugin';
import { Calldata } from '../types';
import { TransactionOutput } from './classes/UTXO';
import { Revert } from '../types/Revert';

export * from '../env/global';

@final
export class BlockchainEnvironment {
    private static readonly MAX_U16: u16 = 65535;

    public readonly DEAD_ADDRESS: Address = Address.dead();

    private storage: MapUint8Array = new MapUint8Array();
    private _selfContract: Potential<OP_NET> = null;
    private _plugins: Plugin[] = [];

    private _mockedCallResult: Uint8Array = new Uint8Array(1);
    private _mockedValidateBitcoinAddressResult: bool = false;
    private _mockedDeployContractResponse: Address = new Address();
    private _mockedVerifySchnorrSignature: boolean = false;
    private _mockedOutputs: TransactionOutput[] = [];

    private _block: Potential<Block> = null;

    @inline
    public get block(): Block {
        if (!this._block) {
            throw new Revert('Block is required');
        }

        return this._block as Block;
    }

    private _tx: Potential<Transaction> = null;

    @inline
    public get tx(): Transaction {
        if (!this._tx) {
            throw new Revert('Transaction is required');
        }

        return this._tx as Transaction;
    }

    private _contract: Potential<() => OP_NET> = null;

    public get contract(): OP_NET {
        return this._selfContract as OP_NET;
    }

    public set contract(contract: () => OP_NET) {
        this._contract = contract;

        this.createContractIfNotExists();
    }

    private _nextPointer: u16 = 0;

    public get nextPointer(): u16 {
        if (this._nextPointer === BlockchainEnvironment.MAX_U16) {
            throw new Revert(`Out of storage pointer.`);
        }

        this._nextPointer += 1;

        return this._nextPointer;
    }

    public _contractDeployer: Potential<Address> = null;

    public get contractDeployer(): Address {
        if (!this._contractDeployer) {
            throw new Revert('Deployer is required');
        }

        return this._contractDeployer as Address;
    }

    public _contractAddress: Potential<Address> = null;

    public get contractAddress(): Address {
        if (!this._contractAddress) {
            throw new Revert('Contract address is required');
        }

        return this._contractAddress as Address;
    }

    public registerPlugin(plugin: Plugin): void {
        this._plugins.push(plugin);
    }

    public onDeployment(calldata: Calldata): void {
        for (let i: i32 = 0; i < this._plugins.length; i++) {
            const plugin = this._plugins[i];

            plugin.onDeployment(calldata);
        }

        this.contract.onDeployment(calldata);
    }

    public onExecutionStarted(): void {
        for (let i: i32 = 0; i < this._plugins.length; i++) {
            const plugin = this._plugins[i];

            plugin.onExecutionStarted();
        }

        this.contract.onExecutionStarted();
    }

    public onExecutionCompleted(): void {
        for (let i: i32 = 0; i < this._plugins.length; i++) {
            const plugin = this._plugins[i];

            plugin.onExecutionCompleted();
        }

        this.contract.onExecutionCompleted();
    }

    public clearMockedResults(): void {
        this._mockedCallResult = new Uint8Array(1);
        this._mockedValidateBitcoinAddressResult = false;
        this._mockedDeployContractResponse = new Address();
        this._mockedVerifySchnorrSignature = false;
        this._mockedOutputs = [];
    }

    public mockCallResult(data: Uint8Array): void {
        this._mockedCallResult = data;
    }

    public mockValidateBitcoinAddressResult(result: bool): void {
        this._mockedValidateBitcoinAddressResult = result;
    }

    public mockDeployContractResponse(result: Address): void {
        this._mockedDeployContractResponse = result;
    }

    public mockVerifySchnorrSignature(result: boolean): void {
        this._mockedVerifySchnorrSignature = result;
    }

    public mockTransactionOutput(transactions: TransactionOutput[]): void {
        this._mockedOutputs = transactions;
    }

    public mockedTransactionInputs(): Uint8Array {
        throw new Revert('TODO.');
    }

    public mockedTransactionOutput(): Uint8Array {
        if (this._mockedOutputs.length > 250) {
            throw new Revert(`Out of storage pointer.`);
        }

        const writer = new BytesWriter(this._mockedOutputs.length * (2 + 2 + 64 + 8) + 2);
        writer.writeU16(u16(this._mockedOutputs.length));

        for (let i = 0; i < this._mockedOutputs.length; i++) {
            const output = this._mockedOutputs[i];

            writer.writeU16(output.index);
            writer.writeStringWithLength(output.to);
            writer.writeU64(output.value);
        }

        return writer.getBuffer();
    }

    public clearStorage(): void {
        this.storage.clear();
    }

    public setEnvironmentVariables(data: Uint8Array): void {
        const reader: BytesReader = new BytesReader(data);

        const blockHash = reader.readBytes(32);
        const blockNumber = reader.readU64();
        const blockMedianTime = reader.readU64();
        const txId = reader.readBytes(32);
        const txHash = reader.readBytes(32);
        const contractAddress = reader.readAddress();
        const contractDeployer = reader.readAddress();
        const caller = reader.readAddress();
        const origin = reader.readAddress();

        this._tx = new Transaction(
            caller,
            origin,
            txId,
            txHash,
            true,
        );

        this._contractDeployer = contractDeployer;
        this._contractAddress = contractAddress;

        this._block = new Block(blockHash, blockNumber, blockMedianTime);
    }

    public call(destinationContract: Address, _calldata: BytesWriter): BytesReader {
        if (!destinationContract) {
            throw new Revert('Destination contract is required');
        }

        return new BytesReader(this._mockedCallResult);
    }

    public log(data: string): void {
        console.log(data);
    }

    public emit(event: NetEvent): void {
        /*const data = event.getEventData();
        const writer = new BytesWriter(event.eventType.length + 6 + data.byteLength);

        writer.writeStringWithLength(event.eventType);
        writer.writeBytesWithLength(data);

        emit(writer.getBuffer().buffer, writer.bufferLength());*/
    }

    public validateBitcoinAddress(_address: string): bool {
        return this._mockedValidateBitcoinAddressResult;
    }

    public deployContractFromExisting(
        _existingAddress: Address,
        _salt: u256,
    ): Address {
        return this._mockedDeployContractResponse;
    }

    public getStorageAt(
        pointerHash: Uint8Array,
    ): Uint8Array {
        this.hasPointerStorageHash(pointerHash);
        if (this.storage.has(pointerHash)) {
            return this.storage.get(pointerHash);
        }

        return new Uint8Array(32);
    }

    public sha256(buffer: Uint8Array): Uint8Array {
        return sha256(buffer);
    }

    public hash256(buffer: Uint8Array): Uint8Array {
        return sha256(sha256(buffer));
    }

    public verifySchnorrSignature(
        _publicKey: Address,
        _signature: Uint8Array,
        _hash: Uint8Array,
    ): boolean {
        return this._mockedVerifySchnorrSignature;
    }

    public hasStorageAt(pointerHash: Uint8Array): bool {
        // We mark zero as the default value for the storage, if something is 0, the storage slot get deleted or is non-existent
        const val: Uint8Array = this.getStorageAt(pointerHash);

        return !eqUint(val, EMPTY_BUFFER);
    }

    public setStorageAt(pointerHash: Uint8Array, value: Uint8Array): void {
        this._internalSetStorageAt(pointerHash, value);
    }

    private createContractIfNotExists(): void {
        if (!this._contract) {
            throw new Revert('Contract is required');
        }

        if (!this._selfContract) {
            this._selfContract = this._contract();
        }
    }

    private _internalSetStorageAt(pointerHash: Uint8Array, value: Uint8Array): void {
        this.storage.set(pointerHash, value);
    }

    private hasPointerStorageHash(pointer: Uint8Array): bool {
        return this.storage.has(pointer);
    }
}
