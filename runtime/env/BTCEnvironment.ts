import { Address, ADDRESS_BYTE_LENGTH, PotentialAddress } from '../types/Address';
import { MemorySlotPointer } from '../memory/MemorySlotPointer';
import { MemorySlotData } from '../memory/MemorySlot';
import { u256 } from 'as-bignum/assembly';
import { ABIRegistry } from '../universal/ABIRegistry';
import { BytesReader } from '../buffer/BytesReader';
import { encodePointerHash } from '../math/abi';
import { BytesWriter } from '../buffer/BytesWriter';
import { MAX_EVENTS, NetEvent } from '../events/NetEvent';
import { Potential } from '../lang/Definitions';
import { OP_NET } from '../contracts/OP_NET';
import { PointerStorage } from '../types';
import {
    callContract,
    deploy,
    deployFromAddress,
    encodeAddress,
    loadPointer,
    log,
    storePointer,
} from './global';
import { DeployContractResponse } from '../interfaces/DeployContractResponse';
import { MapU256 } from '../generic/MapU256';

export * from '../env/global';

@final
export class BlockchainEnvironment {
    private static readonly MAX_U16: u16 = 65535;
    private static readonly runtimeException: string = 'RuntimeException';
    public readonly DEAD_ADDRESS: Address = 'bc1dead';
    private storage: PointerStorage = new MapU256();
    private events: NetEvent[] = [];
    private currentBlock: u256 = u256.Zero;

    private _selfContract: Potential<OP_NET> = null;

    private _txOrigin: PotentialAddress = null;

    public get txOrigin(): Address {
        if (!this._txOrigin) {
            throw this.error('Callee is required');
        }

        return this._txOrigin as Address;
    }

    private _msgSender: PotentialAddress = null;

    public get msgSender(): Address {
        if (!this._msgSender) {
            throw this.error('Caller is required');
        }

        return this._msgSender as Address;
    }

    private _timestamp: u64 = 0;

    public get timestamp(): u64 {
        return this._timestamp;
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

    public get blockNumber(): u256 {
        return this.currentBlock;
    }

    public get blockNumberU64(): u64 {
        return this.currentBlock.toU64();
    }

    public setEnvironment(data: Uint8Array): void {
        const reader: BytesReader = new BytesReader(data);

        this._msgSender = reader.readAddress();
        this._txOrigin = reader.readAddress(); // "leftmost thing in the call chain"
        this.currentBlock = reader.readU256();

        this._owner = reader.readAddress();
        this._contractAddress = reader.readAddress();

        this._timestamp = reader.readU64();

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

    public addEvent(event: NetEvent): void {
        if (this.events.length >= i32(MAX_EVENTS)) {
            throw this.error(`Too many events in the same transaction.`);
        }

        this.events.push(event);
    }

    public getEvents(): Uint8Array {
        const eventLength: u16 = u16(this.events.length);
        if (eventLength > MAX_EVENTS) {
            throw this.error('Too many events');
        }

        const buffer: BytesWriter = new BytesWriter(this.getEventSize());
        buffer.writeU16(eventLength);

        for (let i: u8 = 0; i < eventLength; i++) {
            const event: NetEvent = this.events[i];

            buffer.writeStringWithLength(event.eventType);
            buffer.writeU64(0); //event.getEventDataSelector()
            buffer.writeBytesWithLength(event.getEventData());
        }

        return buffer.getBuffer();
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
        pointer: u16,
        subPointer: MemorySlotPointer,
        defaultValue: MemorySlotData<u256>,
    ): MemorySlotData<u256> {
        const pointerHash: MemorySlotPointer = encodePointerHash(pointer, subPointer);
        this.ensureStorageAtPointer(pointerHash, defaultValue);

        if (this.storage.has(pointerHash)) {
            return this.storage.get(pointerHash);
        }

        return defaultValue;
    }

    public hasStorageAt(pointer: u16, subPointer: MemorySlotPointer): bool {
        // We mark zero as the default value for the storage, if something is 0, the storage slot get deleted or is non-existent
        const val: u256 = this.getStorageAt(pointer, subPointer, u256.Zero);

        return u256.ne(val, u256.Zero);
    }

    public setStorageAt(
        pointer: u16,
        keyPointer: MemorySlotPointer,
        value: MemorySlotData<u256>,
    ): void {
        const pointerHash: u256 = encodePointerHash(pointer, keyPointer);

        this._internalSetStorageAt(pointerHash, value);
    }

    public getMethodSelectors(): Uint8Array {
        return ABIRegistry.getMethodSelectors();
    }

    private getEventSize(): u32 {
        let size: u32 = 2;

        for (let i: u32 = 0; i < <u32>this.events.length; i++) {
            const event: NetEvent = this.events[i];
            size += 2 + event.eventType.length + 8 + event.length + 4;
        }

        return size;
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
        return new Error(`${BlockchainEnvironment.runtimeException}: ${msg}`);
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
        if (!this.hasPointerStorageHash(pointerHash)) {
            if (u256.eq(defaultValue, u256.Zero)) {
                return;
            }

            this._internalSetStorageAt(pointerHash, defaultValue);
        }
    }
}
