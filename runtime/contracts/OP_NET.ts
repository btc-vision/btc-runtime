import { IBTC } from '../interfaces/IBTC';
import { Address } from '../types/Address';
import { Blockchain } from '../env';
import { Calldata } from '../universal/ABIRegistry';
import { BytesWriter } from '../buffer/BytesWriter';
import { encodeSelector, Selector } from '../math/abi';
import { Revert } from '../types/Revert';
import { MAX_EVENT_DATA_SIZE, NetEvent } from '../events/NetEvent';
import { StoredBoolean } from '../storage/StoredBoolean';

export class OP_NET implements IBTC {
    private readonly instantiated: StoredBoolean = new StoredBoolean(Blockchain.nextPointer, false);

    constructor() {
        if (!this.instantiated.value) {
            this.instantiated.value = true;
            this.onContractInstantiate();
        }
    }

    public get address(): string {
        return Blockchain.contractAddress;
    }

    public get owner(): string {
        return Blockchain.owner;
    }

    public callMethod(method: Selector, _calldata: Calldata): BytesWriter {
        switch (method) {
            default:
                throw new Revert('Method not found');
        }
    }

    // Overwrite this method in your contract
    public onContractInstantiate(): void {}

    public callView(method: Selector): BytesWriter {
        const response = new BytesWriter();

        switch (method) {
            case encodeSelector('address'):
                response.writeAddress(this.address);
                break;
            case encodeSelector('owner'):
                response.writeAddress(this.owner);
                break;
            default:
                throw new Revert('Method not found');
        }

        return response;
    }

    protected emitEvent(event: NetEvent): void {
        if (event.length > MAX_EVENT_DATA_SIZE) {
            throw new Error('Event data length exceeds maximum length.');
        }

        Blockchain.addEvent(event);
    }

    protected isSelf(address: Address): boolean {
        return this.address === address;
    }

    protected onlyOwner(caller: Address): void {
        if (this.owner !== caller) {
            throw new Revert('Only owner can call this method');
        }
    }
}
