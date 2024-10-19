import { Address, ADDRESS_BYTE_LENGTH } from '../types/Address';
import { MemorySlotPointer } from '../memory/MemorySlotPointer';
import { MemorySlotData } from '../memory/MemorySlot';
import { u256 } from 'as-bignum/assembly';
import { BytesReader } from '../buffer/BytesReader';
import { BytesWriter } from '../buffer/BytesWriter';
import { NetEvent } from '../events/NetEvent';
import { Potential } from '../lang/Definitions';
import { OP_NET } from '../contracts/OP_NET';
import { PointerStorage } from '../types';
import {
    callContract,
    deploy,
    deployFromAddress,
    emit,
    encodeAddress,
    loadPointer,
    log,
    storePointer,
} from './global';
import { DeployContractResponse } from '../interfaces/DeployContractResponse';
import { MapU256 } from '../generic/MapU256';
import { Block } from './classes/Block';
import { Transaction } from './classes/Transaction';

export * from '../env/global';

export function runtimeError(msg: string): Error {
    return new Error(`RuntimeException: ${msg}`);
}

@final
export class BlockchainEnvironment {
    private static readonly MAX_U16: u16 = 65535;

    public readonly DEAD_ADDRESS: Address = Address.dead();

    private storage: PointerStorage = new MapU256();
    private _selfContract: Potential<OP_NET> = null;

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

    public _owner: Potential<Address> = null;

    public get owner(): Address {
        if (!this._owner) {
            throw this.error('Owner is required');
        }

        return this._owner as Address;
    }

    public _contractAddress: Potential<Address> = null;

    public get contractAddress(): Address {
        if (!this._contractAddress) {
            throw this.error('Contract address is required');
        }

        return this._contractAddress as Address;
    }

    public setEnvironment(data: Uint8Array): void {
        const reader: BytesReader = new BytesReader(data);

        this._tx = new Transaction(
            reader.readAddress(),
            reader.readAddress(),
            reader.readBytes(32),
        );

        const currentBlock = reader.readU256();

        this._owner = reader.readAddress();
        this._contractAddress = reader.readAddress();

        const medianTimestamp = reader.readU64();
        const safeRnd64 = reader.readU64();

        this._block = new Block(currentBlock, medianTimestamp, safeRnd64);

        this.createContractIfNotExists();
    }

    public call(destinationContract: Address, calldata: BytesWriter): BytesReader {
        if (destinationContract === this._contractAddress) {
            throw this.error('Cannot call self');
        }

        if (!destinationContract) {
            throw this.error('Destination contract is required');
        }

        const call = new BytesWriter(ADDRESS_BYTE_LENGTH + calldata.bufferLength() + 4);
        call.writeAddress(destinationContract);
        call.writeBytesWithLength(calldata.getBuffer());

        const response: Uint8Array = callContract(call.getBuffer());

        return new BytesReader(response);
    }

    public log(data: string): void {
        const writer = new BytesWriter(data.length + 2);
        writer.writeStringWithLength(data);

        const buffer = writer.getBuffer();
        log(buffer);
    }

    public emit(event: NetEvent): void {
        const data = event.getEventData();
        const buffer = new BytesWriter(event.eventType.length + 6 + data.byteLength);

        buffer.writeStringWithLength(event.eventType);
        buffer.writeBytesWithLength(data);

        emit(buffer.getBuffer());
    }

    public encodeVirtualAddress(virtualAddress: Uint8Array): Address {
        const writer: BytesWriter = new BytesWriter(virtualAddress.byteLength + 4);
        writer.writeBytesWithLength(virtualAddress);

        const buffer: Uint8Array = writer.getBuffer();
        const cb: Potential<Uint8Array> = encodeAddress(buffer);
        if (!cb) throw this.error('Failed to encode virtual address');

        const reader: BytesReader = new BytesReader(cb as Uint8Array);
        return reader.readAddress();
    }

    public deployContract(hash: u256, bytecode: Uint8Array): DeployContractResponse {
        const writer = new BytesWriter(32 + bytecode.length);
        writer.writeU256(hash);
        writer.writeBytes(bytecode);

        const cb: Potential<Uint8Array> = deploy(writer.getBuffer());
        if (!cb) throw this.error('Failed to deploy contract');

        const reader: BytesReader = new BytesReader(cb as Uint8Array);
        const virtualAddress: u256 = reader.readU256();
        const contractAddress: Address = reader.readAddress();

        return new DeployContractResponse(virtualAddress, contractAddress);
    }

    public deployContractFromExisting(
        existingAddress: Address,
        salt: u256,
    ): DeployContractResponse {
        const writer = new BytesWriter(ADDRESS_BYTE_LENGTH + 32);
        writer.writeAddress(existingAddress);
        writer.writeU256(salt);

        const buffer: Uint8Array = writer.getBuffer();
        const cb: Potential<Uint8Array> = deployFromAddress(buffer);
        if (!cb) throw this.error('Failed to deploy contract');

        const reader: BytesReader = new BytesReader(cb as Uint8Array);
        const virtualAddress: u256 = reader.readU256();
        const contractAddress: Address = reader.readAddress();

        return new DeployContractResponse(virtualAddress, contractAddress);
    }

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

        const writer: BytesWriter = new BytesWriter(64);
        writer.writeU256(pointerHash);
        writer.writeU256(value);

        const buffer: Uint8Array = writer.getBuffer();
        storePointer(buffer);
    }

    private hasPointerStorageHash(pointer: MemorySlotPointer): bool {
        if (this.storage.has(pointer)) {
            return true;
        }

        // we attempt to load the requested pointer.
        const writer = new BytesWriter(32);
        writer.writeU256(pointer);

        const result: Uint8Array = loadPointer(writer.getBuffer());
        const reader: BytesReader = new BytesReader(result);

        const value: u256 = reader.readU256();
        this.storage.set(pointer, value); // cache the value

        return !u256.eq(value, u256.Zero);
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
