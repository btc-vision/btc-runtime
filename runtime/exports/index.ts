import { Blockchain } from '../env';
import { BytesWriter } from '../buffer/BytesWriter';
import { BytesReader } from '../buffer/BytesReader';
import { Selector } from '../math/abi';
import { Calldata } from '../types';
import { getCalldata } from '../env/global';

export function execute(calldataLength: u32): Uint8Array {
    const calldataBuffer = new ArrayBuffer(calldataLength);
    getCalldata(0, calldataLength, calldataBuffer);

    const calldata: Calldata = new BytesReader(Uint8Array.wrap(calldataBuffer));
    const selector: Selector = calldata.readSelector();
    const result: BytesWriter = Blockchain.contract.execute(selector, calldata);

    Blockchain.contract.onExecutionCompleted();

    return result.getBuffer();
}

export function onDeploy(data: Uint8Array): void {
    const calldata: Calldata = new BytesReader(data);

    Blockchain.contract.onDeployment(calldata);
    Blockchain.contract.onExecutionCompleted();
}

export function setEnvironment(data: Uint8Array): void {
    Blockchain.setEnvironment(data);
}
