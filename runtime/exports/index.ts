import { Blockchain } from '../env';
import { BytesWriter } from '../buffer/BytesWriter';
import { BytesReader } from '../buffer/BytesReader';
import { Selector } from '../math/abi';
import { Calldata } from '../types';

export function execute(data: Uint8Array): Uint8Array {
    const calldata: Calldata = new BytesReader(data);
    const selector: Selector = calldata.readSelector();
    const result: BytesWriter = Blockchain.contract.execute(selector, calldata);

    Blockchain.contract.onExecutionCompleted();

    return result.getBuffer();
}

export function onDeploy(data: Uint8Array): void {
    const calldata: Calldata = new BytesReader(data);

    Blockchain.contract.onDeployment(calldata);
}

export function setEnvironment(data: Uint8Array): void {
    Blockchain.setEnvironment(data);
}
