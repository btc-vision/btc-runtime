import { Blockchain } from '../env';
import { BytesWriter } from '../buffer/BytesWriter';
import { BytesReader } from '../buffer/BytesReader';
import { Selector } from '../math/abi';
import { Calldata } from '../types';
import { env_exit, getCalldata, getEnvironmentVariables } from '../env/global';

const ENVIRONMENT_VARIABLES_BYTE_LENGTH: u32 = 304;

export function execute(calldataLength: u32): u32 {
    const environmentVariablesBuffer = new ArrayBuffer(ENVIRONMENT_VARIABLES_BYTE_LENGTH);
    getEnvironmentVariables(0, ENVIRONMENT_VARIABLES_BYTE_LENGTH, environmentVariablesBuffer);
    Blockchain.setEnvironmentVariables(Uint8Array.wrap(environmentVariablesBuffer));

    const calldataBuffer = new ArrayBuffer(calldataLength);
    getCalldata(0, calldataLength, calldataBuffer);

    const calldata: Calldata = new BytesReader(Uint8Array.wrap(calldataBuffer));
    const selector: Selector = calldata.readSelector();

    Blockchain.onExecutionStarted();

    const result: BytesWriter = Blockchain.contract.execute(selector, calldata);

    Blockchain.onExecutionCompleted();

    const resultBuffer = result.getBuffer().buffer;
    const resultLength = resultBuffer.byteLength;
    if (resultLength > 0) {
        env_exit(0, resultBuffer, resultLength);
    }

    return 0;
}

export function onDeploy(calldataLength: u32): u32 {
    const environmentVariablesBuffer = new ArrayBuffer(ENVIRONMENT_VARIABLES_BYTE_LENGTH);
    getEnvironmentVariables(0, ENVIRONMENT_VARIABLES_BYTE_LENGTH, environmentVariablesBuffer);
    Blockchain.setEnvironmentVariables(Uint8Array.wrap(environmentVariablesBuffer));

    const calldataBuffer = new ArrayBuffer(calldataLength);
    getCalldata(0, calldataLength, calldataBuffer);

    const calldata: Calldata = new BytesReader(Uint8Array.wrap(calldataBuffer));

    Blockchain.onExecutionStarted();
    Blockchain.onDeployment(calldata);
    Blockchain.onExecutionCompleted();

    return 0;
}
