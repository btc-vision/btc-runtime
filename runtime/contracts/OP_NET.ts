import { BytesWriter } from '../buffer/BytesWriter';
import { Blockchain } from '../env';
import { MAX_EVENT_DATA_SIZE, NetEvent } from '../events/NetEvent';
import { IBTC } from '../interfaces/IBTC';
import { encodeSelector, Selector } from '../math/abi';
import { Calldata } from '../types';
import { Address } from '../types/Address';
import { Revert } from '../types/Revert';
import { ADDRESS_BYTE_LENGTH } from '../utils';

export class OP_NET implements IBTC {
    public get address(): Address {
        return Blockchain.contractAddress;
    }

    public get contractDeployer(): Address {
        return Blockchain.contractDeployer;
    }

    public onDeployment(_calldata: Calldata): void {}

    public onExecutionStarted(_selector: Selector, _calldata: Calldata): void {}

    public onExecutionCompleted(_selector: Selector, _calldata: Calldata): void {}

    public execute(method: Selector, _calldata: Calldata): BytesWriter {
        let response: BytesWriter;

        switch (method) {
            case encodeSelector('deployer()'):
                response = new BytesWriter(ADDRESS_BYTE_LENGTH);
                response.writeAddress(this.contractDeployer);
                break;
            default:
                throw new Revert(`Method not found: ${method}`);
        }

        return response;
    }

    protected emitEvent(event: NetEvent): void {
        if (event.length > MAX_EVENT_DATA_SIZE) {
            throw new Revert('Event data length exceeds maximum length.');
        }

        Blockchain.emit(event);
    }

    protected isSelf(address: Address): boolean {
        return this.address === address;
    }

    protected _buildDomainSeparator(): Uint8Array {
        // This method should be overridden in derived classes to provide the domain separator
        throw new Error('Method not implemented.');
    }

    protected onlyDeployer(caller: Address): void {
        if (this.contractDeployer !== caller) {
            throw new Revert('Only deployer can call this method');
        }
    }
}
