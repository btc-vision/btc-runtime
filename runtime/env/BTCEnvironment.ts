import { Address, PotentialAddress } from '../types/Address';
import { MemorySlotPointer } from '../memory/MemorySlotPointer';
import { MemorySlotData } from '../memory/MemorySlot';
import { u256 } from 'as-bignum/assembly';
import { ABIRegistry } from '../universal/ABIRegistry';
import { BytesReader } from '../buffer/BytesReader';
import { encodePointerHash } from '../math/abi';
import { BytesWriter } from '../buffer/BytesWriter';
import { MAX_EVENTS, NetEvent } from '../events/NetEvent';
import { Potential } from '../lang/Definitions';
import { Map } from '../generic/Map';
import { OP_NET } from '../contracts/OP_NET';
import { PointerStorage } from '../types';
import { callContract, deploy, deployFromAddress, loadPointer, log, storePointer } from './global';
import { DeployContractResponse } from '../interfaces/DeployContractResponse';

export * from '../env/global';

@final
export class BlockchainEnvironment {
    private static readonly runtimeException: string = 'RuntimeException';

    private storage: PointerStorage = new Map();
    private events: NetEvent[] = [];

    private _callee: PotentialAddress = null;
    private _caller: PotentialAddress = null;
    private currentBlock: u256 = u256.Zero;

    constructor() {}

    private _timestamp: u64 = 0;

    public get timestamp(): u64 {
        return this._timestamp;
    }

    private _contract: Potential<() => OP_NET> = null;

    public get contract(): OP_NET {
        if (!this._contract) {
            throw this.error('Contract is required');
        }

        return this._contract();
    }

    public set contract(contract: () => OP_NET) {
        this._contract = contract;
    }

    private _nextPointer: u8 = 0;

    public get nextPointer(): u8 {
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

    public callee(): Address {
        if (!this._callee) {
            throw this.error('Callee is required');
        }

        return this._callee as Address;
    }

    public caller(): Address {
        if (!this._caller) {
            throw this.error('Caller is required');
        }

        return this._caller as Address;
    }

    public setEnvironment(data: Uint8Array): void {
        const reader: BytesReader = new BytesReader(data);

        this._caller = reader.readAddress();
        this._callee = reader.readAddress();
        this.currentBlock = reader.readU256();

        this._owner = reader.readAddress();
        this._contractAddress = reader.readAddress();

        this._timestamp = reader.readU64();
    }

    public call(destinationContract: Address, calldata: BytesWriter): BytesReader {
        if (destinationContract === this._callee) {
            throw this.error('Cannot call self');
        }

        const call = new BytesWriter();
        call.writeAddress(destinationContract);
        call.writeBytesWithLength(calldata.getBuffer());

        const response: Uint8Array = callContract(call.getBuffer());

        return new BytesReader(response);
    }

    public log(data: string): void {
        const writer = new BytesWriter();
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
        const eventLength: u8 = u8(this.events.length);
        if (eventLength > MAX_EVENTS) {
            throw this.error('Too many events');
        }

        const buffer: BytesWriter = new BytesWriter();
        buffer.writeU8(eventLength);

        for (let i: u8 = 0; i < eventLength; i++) {
            const event: NetEvent = this.events[i];

            buffer.writeStringWithLength(event.eventType);
            buffer.writeU64(event.getEventDataSelector());
            buffer.writeBytesWithLength(event.getEventData());
        }

        return buffer.getBuffer();
    }

    public deployContract(hash: u256, bytecode: Uint8Array): BytesReader {
        const writer = new BytesWriter();
        writer.writeU256(hash);
        writer.writeBytes(bytecode);

        const cb: Potential<Uint8Array> = deploy(writer.getBuffer());
        if (!cb) throw this.error('Failed to deploy contract');

        return new BytesReader(cb as Uint8Array);
    }

    public deployContractFromExisting(
        existingAddress: Address,
        salt: u256,
    ): DeployContractResponse {
        const writer = new BytesWriter();
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

        // maybe find a better way for this
        const allKeys: u256[] = this.storage.keys();
        for (let i: i32 = 0; i < allKeys.length; i++) {
            const v: u256 = allKeys[i];

            if (u256.eq(v, pointerHash)) {
                return this.storage.get(v);
            }
        }

        return defaultValue;
    }

    public hasStorageAt(pointer: u16, subPointer: MemorySlotPointer): bool {
        // We mark zero as the default value for the storage, if something is 0, the storage slot get deleted or is non-existent
        const val: u256 = this.getStorageAt(pointer, subPointer, u256.Zero);
        return val != u256.Zero;
    }

    public setStorageAt(
        pointer: u16,
        keyPointer: MemorySlotPointer,
        value: MemorySlotData<u256>,
    ): void {
        const pointerHash: u256 = encodePointerHash(pointer, keyPointer);

        this._internalSetStorageAt(pointerHash, value);
    }

    public getViewSelectors(): Uint8Array {
        return ABIRegistry.getViewSelectors();
    }

    public getMethodSelectors(): Uint8Array {
        return ABIRegistry.getMethodSelectors();
    }

    public getWriteMethods(): Uint8Array {
        return ABIRegistry.getWriteMethods();
    }

    private error(msg: string): Error {
        return new Error(`${BlockchainEnvironment.runtimeException}: ${msg}`);
    }

    private _internalSetStorageAt(pointerHash: u256, value: MemorySlotData<u256>): void {
        const keys: u256[] = this.storage.keys();

        // Delete the old value, there is a bug with u256 and maps.
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];

            if (u256.eq(key, pointerHash)) {
                this.storage.delete(key);
            }
        }

        this.storage.set(pointerHash, value);

        const writer: BytesWriter = new BytesWriter();
        writer.writeU256(pointerHash);
        writer.writeU256(value);

        const buffer: Uint8Array = writer.getBuffer();
        storePointer(buffer);
    }

    private hasPointerStorageHash(pointer: MemorySlotPointer): bool {
        const keys = this.storage.keys();

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];

            if (u256.eq(key, pointer)) {
                return true;
            }
        }

        // we attempt to load the requested pointer.
        const writer = new BytesWriter();
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
