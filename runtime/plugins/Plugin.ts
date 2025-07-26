import { Calldata } from '../types';
import { Selector } from '../math/abi';

export class Plugin {
    public onDeployment(_calldata: Calldata): void {}

    public onExecutionStarted(selector: Selector, calldata: Calldata): void {}

    public onExecutionCompleted(selector: Selector, calldata: Calldata): void {}
}
