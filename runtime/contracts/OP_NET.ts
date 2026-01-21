import { BytesWriter } from '../buffer/BytesWriter';
import { Blockchain } from '../env';
import { MAX_EVENT_DATA_SIZE, NetEvent } from '../events/NetEvent';
import { IBTC } from '../interfaces/IBTC';
import { encodeSelector, Selector } from '../math/abi';
import { Calldata } from '../types';
import { Address } from '../types/Address';
import { Revert } from '../types/Revert';
import { ADDRESS_BYTE_LENGTH } from '../utils';
import { Plugin } from '../plugins/Plugin';

export class OP_NET implements IBTC {
    /**
     * Registered plugins that can handle method selectors.
     * Plugins are checked in registration order when execute() is called.
     */
    private readonly _plugins: Plugin[] = [];

    public get address(): Address {
        return Blockchain.contractAddress;
    }

    public get contractDeployer(): Address {
        return Blockchain.contractDeployer;
    }

    public onDeployment(calldata: Calldata): void {
        // Call onDeployment for all registered plugins
        for (let i = 0; i < this._plugins.length; i++) {
            this._plugins[i].onDeployment(calldata);
        }
    }

    /**
     * Called when the contract's bytecode is updated via updateContractFromExisting.
     * Override this method to perform migration logic when the contract is upgraded.
     *
     * @param calldata - The calldata passed to updateContractFromExisting
     *
     * @example
     * ```typescript
     * public override onUpdate(calldata: Calldata): void {
     *     super.onUpdate(calldata); // Call plugins
     *     const version = calldata.readU64();
     *     // Perform migration based on version
     * }
     * ```
     */
    public onUpdate(calldata: Calldata): void {
        // Call onUpdate for all registered plugins
        for (let i = 0; i < this._plugins.length; i++) {
            this._plugins[i].onUpdate(calldata);
        }
    }

    public onExecutionStarted(selector: Selector, calldata: Calldata): void {
        // Call onExecutionStarted for all registered plugins
        for (let i = 0; i < this._plugins.length; i++) {
            this._plugins[i].onExecutionStarted(selector, calldata);
        }
    }

    public onExecutionCompleted(selector: Selector, calldata: Calldata): void {
        // Call onExecutionCompleted for all registered plugins
        for (let i = 0; i < this._plugins.length; i++) {
            this._plugins[i].onExecutionCompleted(selector, calldata);
        }
    }

    public execute(method: Selector, calldata: Calldata): BytesWriter {
        // Check built-in methods first
        switch (method) {
            case encodeSelector('deployer()'): {
                const response = new BytesWriter(ADDRESS_BYTE_LENGTH);
                response.writeAddress(this.contractDeployer);
                return response;
            }
        }

        // Try registered plugins
        const startOffset = calldata.getOffset();
        for (let i = 0; i < this._plugins.length; i++) {
            const result = this._plugins[i].execute(method, calldata);
            if (result !== null) {
                return result;
            }

            calldata.setOffset(startOffset);
        }

        // No handler found
        throw new Revert(`Method not found: ${method}`);
    }

    /**
     * Registers a plugin to handle method selectors automatically.
     * Plugins are checked in registration order when the contract's execute() falls through to super.
     *
     * @example
     * ```typescript
     * public constructor() {
     *     super();
     *     this.registerPlugin(new UpgradeablePlugin(144));
     * }
     * ```
     *
     * @param plugin - The plugin to register
     */
    protected registerPlugin(plugin: Plugin): void {
        this._plugins.push(plugin);
    }

    protected emitEvent(event: NetEvent): void {
        if (event.length > MAX_EVENT_DATA_SIZE) {
            throw new Revert('Event data length exceeds maximum length.');
        }

        Blockchain.emit(event);
    }

    protected isSelf(address: Address): boolean {
        return this.address === address;
    }

    protected _buildDomainSeparator(): Uint8Array {
        // This method should be overridden in derived classes to provide the domain separator
        throw new Error('Method not implemented.');
    }

    protected onlyDeployer(caller: Address): void {
        if (this.contractDeployer !== caller) {
            throw new Revert('Only deployer can call this method');
        }
    }
}
