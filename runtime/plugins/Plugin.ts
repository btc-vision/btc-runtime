import { Calldata } from '../types';
import { Selector } from '../math/abi';
import { BytesWriter } from '../buffer/BytesWriter';

/**
 * Base class for plugins that can extend contract functionality.
 *
 * Plugins can be registered with OP_NET contracts to automatically
 * handle method selectors without requiring manual delegation in execute().
 *
 * @example
 * ```typescript
 * class MyPlugin extends Plugin {
 *     public execute(method: Selector, calldata: Calldata): BytesWriter | null {
 *         switch (method) {
 *             case encodeSelector('myMethod()'):
 *                 return this.myMethod();
 *             default:
 *                 return null; // Not handled
 *         }
 *     }
 * }
 * ```
 */
export class Plugin {
    public onDeployment(_calldata: Calldata): void {}

    public onUpdate(_calldata: Calldata): void {}

    public onExecutionStarted(_selector: Selector, _calldata: Calldata): void {}

    public onExecutionCompleted(_selector: Selector, _calldata: Calldata): void {}

    /**
     * Attempts to execute a method.
     *
     * @param _method - The method selector
     * @param _calldata - The calldata
     * @returns BytesWriter response if handled, null if not handled
     */
    public execute(_method: Selector, _calldata: Calldata): BytesWriter | null {
        return null;
    }
}
