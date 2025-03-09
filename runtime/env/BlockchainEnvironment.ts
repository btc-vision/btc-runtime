import { u256 } from '@btc-vision/as-bignum/assembly';
import { Address } from '../types/Address';
import { BytesReader } from '../buffer/BytesReader';
import { BytesWriter } from '../buffer/BytesWriter';
import { OP_NET } from '../contracts/OP_NET';
import { NetEvent } from '../events/NetEvent';
import { Potential } from '../lang/Definitions';
import { Block } from './classes/Block';
import { Transaction } from './classes/Transaction';
import {
    callContract,
    deployFromAddress,
    emit,
    env_exit,
    getCallResult,
    log,
    sha256,
    validateBitcoinAddress,
    verifySchnorrSignature,
} from './global';
import { eqUint, MapUint8Array } from '../generic/MapUint8Array';
import { EMPTY_BUFFER } from '../math/bytes';

export * from '../env/global';

export function runtimeError(msg: string): Error {
    return new Error(`RuntimeException: ${msg}`);
}

export class BlockchainEnvironment {//extends BlockchainEnvironment {
    protected static readonly MAX_U16: u16 = 65535;

    public readonly DEAD_ADDRESS: Address = Address.dead();

    protected storage: MapUint8Array = new MapUint8Array();
    protected _selfContract: Potential<OP_NET> = null;

    protected _block: Potential<Block> = null;

    @inline
    public get block(): Block {
        if (!this._block) {
            throw this.error('Block is required');
        }

        return this._block as Block;
    }

    protected _tx: Potential<Transaction> = null;

    @inline
    public get tx(): Transaction {
        if (!this._tx) {
            throw this.error('Transaction is required');
        }

        return this._tx as Transaction;
    }

    protected _contract: Potential<() => OP_NET> = null;

    public get contract(): OP_NET {
        return this._selfContract as OP_NET;
    }

    public set contract(contract: () => OP_NET) {
        this._contract = contract;

        this.createContractIfNotExists();
    }

    protected _nextPointer: u16 = 0;

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

    public setEnvironmentVariables(data: Uint8Array): void {
        const reader: BytesReader = new BytesReader(data);

        const blockHash = reader.readBytes(32);
        const blockNumber = reader.readU64();
        const blockMedianTime = reader.readU64();
        const txHash = reader.readBytes(32);
        const contractAddress = reader.readAddress();
        const contractDeployer = reader.readAddress();
        const caller = reader.readAddress();
        const origin = reader.readAddress();

        this._tx = new Transaction(
            caller,
            origin,
            txHash,
        );

        this._contractDeployer = contractDeployer;
        this._contractAddress = contractAddress;

        this._block = new Block(blockHash, blockNumber, blockMedianTime);
    }

    private createContractIfNotExists(): void {
        if (!this._contract) {
            throw this.error('Contract is required');
        }

        if (!this._selfContract) {
            this._selfContract = this._contract();
        }
    }

    protected error(msg: string): Error {
        return runtimeError(msg);
    }



    private _mockedCallResult: Uint8Array = new Uint8Array(1);
    private _mockedValidateBitcoinAddressResult: bool = false;
    private _mockedEncodeVirtualAddressResult: Address = new Address();
    private _mockedDeployContractResponse: Address = new Address();
    private _mockedVerifySchnorrSignature: boolean = false;

    public clearMockedResults(): void {
        this._mockedCallResult = new Uint8Array(1);
        this._mockedValidateBitcoinAddressResult = false;
        this._mockedEncodeVirtualAddressResult = new Address();
        this._mockedDeployContractResponse = new Address();
        this._mockedVerifySchnorrSignature = false;
    }

    public mockCallResult(result: Uint8Array): void {
        this._mockedCallResult = result;
    }

    public mockValidateBitcoinAddressResult(result: bool): void {
        this._mockedValidateBitcoinAddressResult = result;
    }

    public mockEncodeVirtualAddressResult(result: Address): void {
        this._mockedEncodeVirtualAddressResult = result;
    }

    public mockDeployContractResponse(result: Address): void {
        this._mockedDeployContractResponse = result;
    }

    public mockVerifySchnorrSignature(result: boolean): void {
        this._mockedVerifySchnorrSignature = result;
    }

    public clearStorage():void{
        this.storage.clear()
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
        const writer = new BytesWriter(data.length + 2);
        writer.writeString(data);

        const buffer = writer.getBuffer();
        //log(buffer);
    }

    public emit(event: NetEvent): void {
        //const data = event.getEventData();
        //const writer = new BytesWriter(event.eventType.length + 6 + data.byteLength);

        //writer.writeStringWithLength(event.eventType);
        //writer.writeBytesWithLength(data);

        //emit(writer.getBuffer().buffer, writer.bufferLength());
    }

    public validateBitcoinAddress(address: string): bool {
        return this._mockedValidateBitcoinAddressResult;
    }

    public encodeVirtualAddress(virtualAddress: u8[]): Address {
        return this._mockedEncodeVirtualAddressResult;
    }

    public deployContractFromExisting(
        existingAddress: Address,
        salt: u256,
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

    private _internalSetStorageAt(pointerHash: Uint8Array, value: Uint8Array): void {
        this.storage.set(pointerHash, value);
    }

    private hasPointerStorageHash(pointer: Uint8Array): bool {
        return this.storage.has(pointer);
    }
}