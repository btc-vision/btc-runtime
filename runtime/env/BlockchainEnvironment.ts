import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesReader } from '../buffer/BytesReader';
import { BytesWriter } from '../buffer/BytesWriter';
import { OP_NET } from '../contracts/OP_NET';
import { NetEvent } from '../events/NetEvent';
import { Potential } from '../lang/Definitions';
import { Address } from '../types/Address';
import { ADDRESS_BYTE_LENGTH } from '../utils';
import { Block } from './classes/Block';
import { Transaction } from './classes/Transaction';
import {
    callContract,
    deployFromAddress,
    emit,
    env_exit,
    getAccountType,
    getBlockHash,
    getCallResult,
    loadPointer,
    log,
    sha256,
    storePointer,
    tLoadPointer,
    tStorePointer,
    validateBitcoinAddress,
    verifySchnorrSignature,
} from './global';
import { eqUint, MapUint8Array } from '../generic/MapUint8Array';
import { EMPTY_BUFFER } from '../math/bytes';
import { Plugin } from '../plugins/Plugin';
import { Calldata } from '../types';
import { Revert } from '../types/Revert';

export * from '../env/global';

@final
export class BlockchainEnvironment {
    public readonly DEAD_ADDRESS: Address = Address.dead();

    private storage: MapUint8Array = new MapUint8Array();
    private transientStorage: MapUint8Array = new MapUint8Array();
    private _selfContract: Potential<OP_NET> = null;
    private _plugins: Plugin[] = [];

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

        this._tx = new Transaction(caller, origin, txId, txHash);

        this._contractDeployer = contractDeployer;
        this._contractAddress = contractAddress;
        this._chainId = chainId;
        this._protocolId = protocolId;

        this._block = new Block(blockHash, blockNumber, blockMedianTime);

        this.createContractIfNotExists();
    }

    public call(destinationContract: Address, calldata: BytesWriter): BytesReader {
        if (!destinationContract) {
            throw new Revert('Destination contract is required');
        }

        const resultLengthBuffer = new ArrayBuffer(32);
        const status = callContract(
            destinationContract.buffer,
            calldata.getBuffer().buffer,
            calldata.bufferLength(),
            resultLengthBuffer,
        );

        const reader = new BytesReader(Uint8Array.wrap(resultLengthBuffer));
        const resultLength = reader.readU32(true);
        const resultBuffer = new ArrayBuffer(resultLength);
        getCallResult(0, resultLength, resultBuffer);

        if (status !== 0) {
            env_exit(status, resultBuffer, resultLength);
        }

        return new BytesReader(Uint8Array.wrap(resultBuffer));
    }

    public log(data: string): void {
        const writer = new BytesWriter(String.UTF8.byteLength(data));
        writer.writeString(data);

        const buffer = writer.getBuffer();
        log(buffer.buffer, buffer.length);
    }

    public emit(event: NetEvent): void {
        const data = event.getEventData();
        const writer = new BytesWriter(String.UTF8.byteLength(event.eventType) + 8 + data.byteLength);

        writer.writeStringWithLength(event.eventType);
        writer.writeBytesWithLength(data);

        emit(writer.getBuffer().buffer, writer.bufferLength());
    }

    public validateBitcoinAddress(address: string): bool {
        const writer = new BytesWriter(String.UTF8.byteLength(address));
        writer.writeString(address);

        const result = validateBitcoinAddress(writer.getBuffer().buffer, address.length);

        return result === 1;
    }

    public deployContractFromExisting(
        existingAddress: Address,
        salt: u256,
        calldata: BytesWriter,
    ): Address {
        const resultAddressBuffer = new ArrayBuffer(ADDRESS_BYTE_LENGTH);
        const callDataBuffer = calldata.getBuffer().buffer;

        const status = deployFromAddress(
            existingAddress.buffer,
            salt.toUint8Array(true).buffer,
            callDataBuffer,
            callDataBuffer.byteLength,
            resultAddressBuffer,
        );

        // TODO: Decode revert data if status is not 0
        if (status !== 0) {
            throw new Revert('Failed to deploy contract');
        }

        const contractAddressReader = new BytesReader(Uint8Array.wrap(resultAddressBuffer));
        return contractAddressReader.readAddress();
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
        publicKey: Address,
        signature: Uint8Array,
        hash: Uint8Array,
    ): boolean {
        const result: u32 = verifySchnorrSignature(publicKey.buffer, signature.buffer, hash.buffer);

        return result === 1;
    }

    public isContract(address: Address): boolean {
        return getAccountType(address.buffer) !== 0;
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
        return getAccountType(address.buffer);
    }

    public getBlockHash(blockNumber: u64): Uint8Array {
        const hash = new ArrayBuffer(32);
        getBlockHash(blockNumber, hash);
        return Uint8Array.wrap(hash);
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

        storePointer(pointerHash.buffer, value.buffer);
    }

    private _internalSetTransientStorageAt(pointerHash: Uint8Array, value: Uint8Array): void {
        this.transientStorage.set(pointerHash, value);

        tStorePointer(pointerHash.buffer, value.buffer);
    }

    private hasPointerStorageHash(pointer: Uint8Array): bool {
        if (this.storage.has(pointer)) {
            return true;
        }

        // we attempt to load the requested pointer.
        const resultBuffer = new ArrayBuffer(32);
        loadPointer(pointer.buffer, resultBuffer);

        const value: Uint8Array = Uint8Array.wrap(resultBuffer);
        this.storage.set(pointer, value); // cache the value

        return !eqUint(value, EMPTY_BUFFER);
    }

    private hasPointerTransientStorageHash(pointer: Uint8Array): bool {
        if (this.transientStorage.has(pointer)) {
            return true;
        }

        // we attempt to load the requested pointer.
        const resultBuffer = new ArrayBuffer(32);
        tLoadPointer(pointer.buffer, resultBuffer);

        const value: Uint8Array = Uint8Array.wrap(resultBuffer);
        this.transientStorage.set(pointer, value); // cache the value

        return !eqUint(value, EMPTY_BUFFER);
    }
}
