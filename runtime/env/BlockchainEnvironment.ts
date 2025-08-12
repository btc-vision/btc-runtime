import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesReader } from '../buffer/BytesReader';
import { BytesWriter } from '../buffer/BytesWriter';
import { OP_NET } from '../contracts/OP_NET';
import { NetEvent } from '../events/NetEvent';
import { Potential } from '../lang/Definitions';
import { Address } from '../types/Address';
import { Block } from './classes/Block';
import { Transaction } from './classes/Transaction';
import { eqUint, MapUint8Array } from '../generic/MapUint8Array';
import { EMPTY_BUFFER } from '../math/bytes';
import { Plugin } from '../plugins/Plugin';
import { Calldata } from '../types';
import { TransactionOutput } from './classes/UTXO';
import { Revert } from '../types/Revert';
import { Selector } from '../math/abi';
import { sha256 } from './global';
import { U16_BYTE_LENGTH, U32_BYTE_LENGTH, U64_BYTE_LENGTH, U8_BYTE_LENGTH } from '../utils';
import { Network, Networks } from '../script/Networks';

export * from '../env/global';

@final
export class BlockchainEnvironment {
    public readonly DEAD_ADDRESS: Address = Address.dead();

    private storage: MapUint8Array = new MapUint8Array();
    private transientStorage: MapUint8Array = new MapUint8Array();
    private _selfContract: Potential<OP_NET> = null;
    private _plugins: Plugin[] = [];

    private _mockedCallResult: Uint8Array = new Uint8Array(1);
    private _mockedValidateBitcoinAddressResult: bool = false;
    private _mockedDeployContractResponse: Address = new Address();
    private _mockedVerifySchnorrSignature: boolean = false;
    private _mockedOutputs: TransactionOutput[] = [];

    private _network: Networks = Networks.Unknown;

    @inline
    public get network(): Networks {
        if (this._network === Networks.Unknown) {
            throw new Revert('Network is required');
        }

        return this._network as Networks;
    }

    @inline
    public set network(network: Networks) {
        if (this._network !== Networks.Unknown) {
            throw new Revert('Network is already set');
        }

        this._network = network;
        this._chainId = Network.getChainId(network);
    }

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
        if (this._nextPointer === u16.MAX_VALUE) {
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

    public _chainId: Potential<Uint8Array> = null;

    public get chainId(): Uint8Array {
        if (!this._chainId) {
            throw new Revert('Chain id is required');
        }

        return this._chainId as Uint8Array;
    }

    public _protocolId: Potential<Uint8Array> = null;

    public get protocolId(): Uint8Array {
        if (!this._protocolId) {
            throw new Revert('Protocol id is required');
        }

        return this._protocolId as Uint8Array;
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

    public onExecutionStarted(selector: Selector, calldata: Calldata): void {
        for (let i: i32 = 0; i < this._plugins.length; i++) {
            const plugin = this._plugins[i];

            plugin.onExecutionStarted(selector, calldata);
        }

        this.contract.onExecutionStarted(selector, calldata);
    }

    public onExecutionCompleted(selector: Selector, calldata: Calldata): void {
        for (let i: i32 = 0; i < this._plugins.length; i++) {
            const plugin = this._plugins[i];

            plugin.onExecutionCompleted(selector, calldata);
        }

        this.contract.onExecutionCompleted(selector, calldata);
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

        //const writer = new BytesWriter(this._mockedOutputs.length * (2 + 2 + 8 + 64 + 8) + 2);
        const writer = new BytesWriter(
            this._mockedOutputs.length *
                (U8_BYTE_LENGTH + U16_BYTE_LENGTH + U32_BYTE_LENGTH + 64 + U64_BYTE_LENGTH) +
                U16_BYTE_LENGTH,
        );
        writer.writeU16(u16(this._mockedOutputs.length));

        for (let i = 0; i < this._mockedOutputs.length; i++) {
            const output = this._mockedOutputs[i];

            //!!! Add support for flags
            writer.writeU8(1);
            writer.writeU16(output.index);

            /*!!! Add support
            if (output.scriptPublicKey !== null) {
                writer.writeBytesWithLength(<Uint8Array>output.scriptPublicKey)
            }
            */

            /*!!! Add support for null to*/
            if (output.to !== null) {
                writer.writeStringWithLength(<string>output.to);
            }

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
        const chainId = reader.readBytes(32);
        const protocolId = reader.readBytes(32);

        this._tx = new Transaction(caller, origin, txId, txHash, true);

        this._contractDeployer = contractDeployer;
        this._contractAddress = contractAddress;
        this._chainId = chainId;
        this._protocolId = protocolId;

        this._network = Network.fromChainId(this.chainId);

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

    public emit(_event: NetEvent): void {}

    public validateBitcoinAddress(_address: string): bool {
        return this._mockedValidateBitcoinAddressResult;
    }

    public deployContractFromExisting(
        _existingAddress: Address,
        _salt: u256,
        calldata: BytesWriter,
    ): Address {
        return this._mockedDeployContractResponse;
    }

    public getStorageAt(pointerHash: Uint8Array): Uint8Array {
        this.hasPointerStorageHash(pointerHash);
        if (this.storage.has(pointerHash)) {
            return this.storage.get(pointerHash);
        }

        return new Uint8Array(32);
    }

    public getTransientStorageAt(pointerHash: Uint8Array): Uint8Array {
        if (this.hasPointerTransientStorageHash(pointerHash)) {
            return this.transientStorage.get(pointerHash);
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

    public isContract(address: Address): boolean {
        return this.getAccountType(address) !== 0;
    }

    public hasStorageAt(pointerHash: Uint8Array): bool {
        // We mark zero as the default value for the storage, if something is 0, the storage slot get deleted or is non-existent
        const val: Uint8Array = this.getStorageAt(pointerHash);

        return !eqUint(val, EMPTY_BUFFER);
    }

    public hasTransientStorageAt(pointerHash: Uint8Array): bool {
        // We mark zero as the default value for the storage, if something is 0, the storage slot get deleted or is non-existent
        const val: Uint8Array = this.getTransientStorageAt(pointerHash);

        return !eqUint(val, EMPTY_BUFFER);
    }

    public setStorageAt(pointerHash: Uint8Array, value: Uint8Array): void {
        this._internalSetStorageAt(pointerHash, value);
    }

    public setTransientStorageAt(pointerHash: Uint8Array, value: Uint8Array): void {
        this._internalSetTransientStorageAt(pointerHash, value);
    }

    public getAccountType(address: Address): u32 {
        return 0;
    }

    public getBlockHash(blockNumber: u64): Uint8Array {
        return new Uint8Array(32);
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

    private _internalSetTransientStorageAt(pointerHash: Uint8Array, value: Uint8Array): void {
        this.transientStorage.set(pointerHash, value);
    }

    private hasPointerStorageHash(pointer: Uint8Array): bool {
        return this.storage.has(pointer);
    }

    private hasPointerTransientStorageHash(pointer: Uint8Array): bool {
        return this.transientStorage.has(pointer);
    }
}
