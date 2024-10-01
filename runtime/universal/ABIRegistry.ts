import { encodeSelector, Selector } from '../math/abi';
import { BytesReader } from '../buffer/BytesReader';
import { BytesWriter } from '../buffer/BytesWriter';

export type Calldata = NonNullable<BytesReader>;

class ABIRegistryBase {
    private methodMap: Selector[] = [];

    public getMethodSelectors(): Uint8Array {
        const writer: BytesWriter = new BytesWriter(2 + this.methodMap.length * 4);
        writer.writeMethodSelectorsMap(this.methodMap);

        return writer.getBuffer();
    }

    // Register methods with their selectors and handlers
    public defineMethodSelector(name: string): void {
        const selector: u32 = encodeSelector(name);

        if (!this.methodMap.includes(selector)) {
            this.methodMap.push(selector);
        }
    }
}

export const ABIRegistry = new ABIRegistryBase();
