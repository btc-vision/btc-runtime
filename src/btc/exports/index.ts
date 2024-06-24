import { Calldata } from '../universal/ABIRegistry';
import { Blockchain } from '../env';
import { Selector } from '../math/abi';
import { BytesWriter } from '../buffer/BytesWriter';
import { BytesReader } from '../buffer/BytesReader';
import { wBTC } from '../../contract/WBTC';

export function readMethod(method: Selector, data: Uint8Array): Uint8Array {
    const contract = new wBTC();

    const calldata: Calldata = new BytesReader(data);
    const result: BytesWriter = contract.callMethod(method, calldata);

    return result.getBuffer();
}

export function readView(method: Selector): Uint8Array {
    const contract = new wBTC();

    const result: BytesWriter = contract.callView(method);
    return result.getBuffer();
}

export function getEvents(): Uint8Array {
    return Blockchain.getEvents();
}

export function getViewABI(): Uint8Array {
    return Blockchain.getViewSelectors();
}

export function getMethodABI(): Uint8Array {
    return Blockchain.getMethodSelectors();
}

export function getWriteMethods(): Uint8Array {
    return Blockchain.getWriteMethods();
}

export function getModifiedStorage(): Uint8Array {
    return Blockchain.storageToBytes();
}

export function initializeStorage(): Uint8Array {
    return Blockchain.initializedStorageToBytes();
}

export function loadStorage(data: Uint8Array): void {
    Blockchain.loadStorage(data);
}

export function loadCallsResponse(data: Uint8Array): void {
    Blockchain.loadCallsResponse(data);
}

export function getCalls(): Uint8Array {
    return Blockchain.getCalls();
}

export function setEnvironment(data: Uint8Array): void {
    Blockchain.setEnvironment(data);
}
