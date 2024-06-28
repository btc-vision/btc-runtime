import { Calldata } from '../universal/ABIRegistry';
import { Blockchain } from '../env';
import { Selector } from '../math/abi';
import { BytesWriter } from '../buffer/BytesWriter';
import { BytesReader } from '../buffer/BytesReader';

export function readMethod(method: Selector, data: Uint8Array): Uint8Array {
    const calldata: Calldata = new BytesReader(data);
    const result: BytesWriter = Blockchain.contract.callMethod(method, calldata);

    return result.getBuffer();
}

export function readView(method: Selector): Uint8Array {
    const result: BytesWriter = Blockchain.contract.callView(method);
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

export function setEnvironment(data: Uint8Array): void {
    Blockchain.setEnvironment(data);
}
