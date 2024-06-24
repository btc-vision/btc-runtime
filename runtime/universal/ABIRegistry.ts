import { encodeSelector, Selector } from '../math/abi';
import { BytesReader } from '../buffer/BytesReader';
import { BytesWriter } from '../buffer/BytesWriter';
import { Map } from '../generic/Map';

export type Calldata = NonNullable<BytesReader>;
export type SelectorsMap = Map<u32, Uint8Array>;

class ABIRegistryBase {
    private methodMap: Selector[] = [];
    private selectors: SelectorsMap = new Map();

    private viewSelectors: Selector[] = [];
    private allowedWriteMethods: Selector[] = [];

    // Register properties with their selectors and handlers
    public defineGetterSelector(name: string, canWrite: boolean): void {
        const selector: Selector = encodeSelector(name);

        const selectorWriter: BytesWriter = new BytesWriter();
        selectorWriter.writeABISelector(name, selector);

        if (!this.selectors.has(selector)) {
            this.selectors.set(selector, selectorWriter.getBuffer());
        }

        if (canWrite) this.addToWriteMethods(selector);

        if (!this.viewSelectors.includes(selector)) {
            this.viewSelectors.push(selector);
        }
    }

    public getViewSelectors(): Uint8Array {
        const writer: BytesWriter = new BytesWriter();
        writer.writeViewSelectorMap(this.selectors);

        return writer.getBuffer();
    }

    public getMethodSelectors(): Uint8Array {
        const writer: BytesWriter = new BytesWriter();
        writer.writeMethodSelectorsMap(this.methodMap);

        return writer.getBuffer();
    }

    public getWriteMethods(): Uint8Array {
        const writer: BytesWriter = new BytesWriter();
        writer.writeMethodSelectorsMap(this.allowedWriteMethods);

        return writer.getBuffer();
    }

    // Register methods with their selectors and handlers
    public defineMethodSelector(name: string, canWrite: boolean): void {
        const selector: u32 = encodeSelector(name);
        if (canWrite) this.addToWriteMethods(selector);

        if (!this.methodMap.includes(selector)) {
            this.methodMap.push(selector);
        }
    }

    private addToWriteMethods(selector: Selector): void {
        if (!this.allowedWriteMethods.includes(selector)) {
            this.allowedWriteMethods.push(selector);
        }
    }
}

export const ABIRegistry = new ABIRegistryBase;
