### Comprehensive Guide to Creating an OP_NET Contract

Creating smart contracts on the OP_NET platform using AssemblyScript requires a different approach compared to
traditional Solidity-based contracts. This guide will walk you through the essential aspects of creating an OP_NET
contract, from understanding constructors and contract instantiation to defining selectors and adding methods.

---

### 1. **Understanding AssemblyScript Constructors**

#### **Key Difference from Solidity**

In Solidity, constructors are special functions that are executed once during contract deployment. However, in
AssemblyScript, the constructor of a class is executed every time the contract is instantiated. This difference is
crucial to understand because it means that you **should not** use the constructor in AssemblyScript as you would in
Solidity.

#### **Best Practices**

- **Do not use the constructor for variable initialization or one-time setup tasks.**
- **Use a method like `onInstantiated` for logic that should only run once.** This method will check if the contract is
  already instantiated and, if not, perform the necessary setup.

#### **Example: Proper Use of Constructor and `onInstantiated`**

```typescript
import { u128, u256 } from 'as-bignum/assembly';
import {
    Address, Blockchain,
    BytesWriter,
    Calldata,
    encodeSelector,
    Map,
    OP20InitParameters,
    Selector,
} from '@btc-vision/btc-runtime/runtime';
import { DeployableOP_20 } from '@btc-vision/btc-runtime/runtime/contracts/DeployableOP_20';

@final
export class MyToken extends DeployableOP_20 {
    constructor() {
        super();

        // DO NOT USE TO DEFINE VARIABLES THAT ARE NOT CONSTANT.
    }

    // This is a Solidity-like constructor. This method will only run once.
    public onInstantiated(): void {
        if (!this.isInstantiated) {
            super.onInstantiated(); // IMPORTANT: Call the parent class's onInstantiated.

            const maxSupply: u256 = u128.fromString('100000000000000000000000000').toU256(); // Your max supply.
            const decimals: u8 = 18; // Your decimals.
            const name: string = 'MyToken'; // Your token name.
            const symbol: string = 'TOKEN'; // Your token symbol.

            this.instantiate(new OP20InitParameters(maxSupply, decimals, name, symbol));

            // Add your logic here, such as minting the initial supply:
            // this._mint(Blockchain.origin, maxSupply);
        }
    }

    public override callMethod(method: Selector, calldata: Calldata): BytesWriter {
        switch (method) {
            case encodeSelector('airdrop'):
                return this.airdrop(calldata);
            default:
                return super.callMethod(method, calldata);
        }
    }

    private airdrop(calldata: Calldata): BytesWriter {
        const drops: Map<Address, u256> = calldata.readAddressValueTuple();

        const addresses: Address[] = drops.keys();
        for (let i: i32 = 0; i < addresses.length; i++) {
            const address = addresses[i];
            const amount = drops.get(address);

            this._mint(address, amount);
        }

        const writer: BytesWriter = new BytesWriter();
        writer.writeBoolean(true);

        return writer;
    }
}
```

### 2. **Contract Structure and `index.ts`**

In the `index.ts` file of your contract, you'll define the ABI (Application Binary Interface) selectors and set up the
contract instantiation. This file is crucial for ensuring that your contract functions correctly within the OP_NET
ecosystem.

#### **Index Structure**

```typescript
import { ABIRegistry, Blockchain } from '@btc-vision/btc-runtime/runtime';
import { MyToken } from './contracts/MyToken';

export function defineSelectors(): void {
    /** OP_NET */
    ABIRegistry.defineGetterSelector('address', false);
    ABIRegistry.defineGetterSelector('owner', false);
    ABIRegistry.defineMethodSelector('isAddressOwner', false);

    /** OP_20 */
    ABIRegistry.defineMethodSelector('allowance', false);
    ABIRegistry.defineMethodSelector('approve', true);
    ABIRegistry.defineMethodSelector('balanceOf', false);
    ABIRegistry.defineMethodSelector('burn', true);
    ABIRegistry.defineMethodSelector('mint', true);
    ABIRegistry.defineMethodSelector('transfer', true);
    ABIRegistry.defineMethodSelector('transferFrom', true);

    ABIRegistry.defineGetterSelector('decimals', false);
    ABIRegistry.defineGetterSelector('name', false);
    ABIRegistry.defineGetterSelector('symbol', false);
    ABIRegistry.defineGetterSelector('totalSupply', false);
    ABIRegistry.defineGetterSelector('maxSupply', false);

    /** Optional */
    ABIRegistry.defineMethodSelector('airdrop', true);

    // Define your selectors here.
}

// DO NOT TOUCH THIS PART.
Blockchain.contract = () => {
    // ONLY CHANGE THE CONTRACT CLASS NAME.
    const contract = new MyToken();
    contract.onInstantiated();

    // DO NOT ADD CUSTOM LOGIC HERE.

    return contract;
}

// VERY IMPORTANT
export * from '@btc-vision/btc-runtime/runtime/exports';
```

#### **Important Notes**

- **DO NOT Modify `Blockchain.contract`:** This function is responsible for instantiating the contract. You should only
  change the class name to match your contract. Adding custom logic here can lead to unexpected behavior and errors.

### 3. **Understanding `defineSelectors`**

#### **Purpose of `defineSelectors`**

The `defineSelectors` function is where you map contract methods and properties to specific selectors. These selectors
allow external calls to interact with your contract's methods and retrieve its properties.

- **Getter Selectors**: These are used for read-only methods that do not modify the contract state (
  e.g., `name`, `symbol`, `totalSupply`).
- **Method Selectors**: These are used for methods that may modify the contract state (
  e.g., `mint`, `transfer`, `approve`).

#### **Adding New Methods**

To add new methods to your contract, you'll need to:

1. **Define the selector in `defineSelectors`:**

   ```typescript
   ABIRegistry.defineMethodSelector('myNewMethod', true);
   ```

2. **Implement the method in your contract:**

   ```typescript
   public override callMethod(method: Selector, calldata: Calldata): BytesWriter {
       switch (method) {
           case encodeSelector('myNewMethod'):
               return this.myNewMethod(calldata);
           default:
               return super.callMethod(method, calldata);
       }
   }

   private myNewMethod(calldata: Calldata): BytesWriter {
       // Your method logic here

       const writer: BytesWriter = new BytesWriter();
       writer.writeBoolean(true); // Example response

       return writer;
   }
   ```

3. **For read-only methods, implement in `callView`:**

`callView` does not have access to any calldata. It is limited to a 4 bytes selector. This is useful for read-only
methods. This could also be used to toggle a boolean or an action similar to.

In the `defineSelectors` function, define the selector for your view method:

```typescript
ABIRegistry.defineGetterSelector('myProperty', false);
```

Implement the view method in your contract:

```typescript
public override callView(method: Selector): BytesWriter {
   const response = new BytesWriter();

   switch (method) {
       case encodeSelector('myProperty'):
           response.writeString('My view method response');
           break;
       default:
           return super.callView(method);
   }

   return response;
}
```

### 4. **Adding New Methods and Views to Your Contract**

#### **Adding a New Method (`callMethod`)**

When adding a new method to your contract, you should define how the contract should respond to specific calls. This
involves decoding the calldata, performing the desired operations, and returning a response.

##### **Example: Adding an Airdrop Method**

```typescript
public override callMethod(method: Selector, calldata: Calldata): BytesWriter {
    switch (method) {
        case encodeSelector('airdrop'):
            return this.airdrop(calldata);
        default:
            return super.callMethod(method, calldata);
    }
}

private airdrop(calldata: Calldata): BytesWriter {
    const drops: Map<Address, u256> = calldata.readAddressValueTuple();

    const addresses: Address[] = drops.keys();
    for (let i: i32 = 0; i < addresses.length; i++) {
        const address = addresses[i];
        const amount = drops.get(address);

        this._mint(address, amount);
    }

    const writer: BytesWriter = new BytesWriter();
    writer.writeBoolean(true);

    return writer;
}
```

#### **Adding a New View (`callView`)**

Views are read-only methods that allow external callers to query the state of your contract without modifying it.

##### **Example: Adding a View Method**

```typescript
public override callView(method: Selector): BytesWriter {
    const response = new BytesWriter();

    switch (method) {
        case encodeSelector('myViewMethod'):
            response.writeString('My view method response');
            break;
        default:
            return super.callView(method);
    }

    return response;
}
```
