import { Calldata } from '../universal/ABIRegistry';
import { Blockchain } from '../env';
import { flushEvents } from '../env/global';
import { Selector } from '../math/abi';
import { BytesWriter } from '../buffer/BytesWriter';
import { BytesReader } from '../buffer/BytesReader';

//TODO: rewrite so selector is not used and is part of the calldata
export function readMethod(data: Uint8Array): Uint8Array {
    const calldata: Calldata = new BytesReader(data);
    const result: BytesWriter = Blockchain.contract.callMethod(calldata);
    // new event dump
//    Blockchain.flushEvents();
    return result.getBuffer();
}

// export function readView(method: Selector): Uint8Array {
//     const result: BytesWriter = Blockchain.contract.callView(method);
//     return result.getBuffer();
// }

// older event dump
export function getEvents(): Uint8Array {
     return Blockchain.getEvents();
}

export function getMethodABI(): Uint8Array {
    return Blockchain.getMethodSelectors();
}

export function setEnvironment(data: Uint8Array): void {
    Blockchain.setEnvironment(data);
}
