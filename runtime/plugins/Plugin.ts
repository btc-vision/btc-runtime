import { Calldata } from '../types';

export class Plugin {
    public onDeployment(_calldata: Calldata): void {
    }

    public onExecutionStarted(): void {
    }

    public onExecutionCompleted(): void {
    }
}