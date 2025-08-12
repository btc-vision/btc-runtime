import { Calldata } from '../types';
import { Selector } from '../math/abi';

export class Plugin {
    public onDeployment(_calldata: Calldata): void {}

    public onExecutionStarted(_selector: Selector, _calldata: Calldata): void {}

    public onExecutionCompleted(_selector: Selector, _calldata: Calldata): void {}
}
