import { IBTC } from '../interfaces/IBTC';
import { Address } from '../types/Address';
import { Blockchain } from '../env';
import { Calldata } from '../universal/ABIRegistry';
import { BytesWriter } from '../buffer/BytesWriter';
import { encodeSelector, Selector } from '../math/abi';
import { Revert } from '../types/Revert';
import { MAX_EVENT_DATA_SIZE, NetEvent } from '../events/NetEvent';

const isAddressOwnerSelector = encodeSelector('isAddressOwner');
const addressSelector = encodeSelector('address');
const ownerSelector = encodeSelector('owner');

export abstract class OP_NET implements IBTC {
    protected constructor() {
    }

    public get address(): string {
        return Blockchain.contractAddress;
    }

    public get owner(): string {
        return Blockchain.owner;
    }

    public callMethod(method: Selector, calldata: Calldata): BytesWriter {
        switch (method) {
            case isAddressOwnerSelector:
                return this.isAddressOwner(calldata);
            default:
                throw new Revert('Method not found');
        }
    }

    public callView(method: Selector): BytesWriter {
        const response = new BytesWriter();

        switch (method) {
            case addressSelector:
                response.writeAddress(this.address);
                break;
            case ownerSelector:
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

    private isAddressOwner(calldata: Calldata): BytesWriter {
        const response = new BytesWriter();
        const owner = calldata.readAddress();

        response.writeBoolean(this.owner === owner);

        return response;
    };
}
