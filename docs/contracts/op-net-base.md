# OP_NET Base Contract

`OP_NET` is the abstract base class for all OPNet smart contracts. It provides the foundational structure for contract lifecycle, method dispatching, event emission, and access control.

## Overview

```typescript
import { OP_NET, Calldata, BytesWriter, Selector, ABIDataTypes, encodeSelector } from '@btc-vision/btc-runtime/runtime';

// Define method selectors (sha256 first 4 bytes of method signature)
const MY_METHOD_SELECTOR: u32 = encodeSelector('myMethod');

@final
export class MyContract extends OP_NET {
    public constructor() {
        super();
    }

    public override onDeployment(calldata: Calldata): void {
        // One-time initialization
    }

    public override execute(method: Selector, calldata: Calldata): BytesWriter {
        switch (method) {
            case MY_METHOD_SELECTOR:
                return this.myMethod(calldata);
            default:
                return super.execute(method, calldata);
        }
    }

    private myMethod(calldata: Calldata): BytesWriter {
        // Method implementation
        return new BytesWriter(0);
    }
}
```

## Contract Lifecycle

### Deployment Phase (Once)

```mermaid
---
config:
  theme: dark
---
flowchart LR
    A["👤 User deploys"] --> B["constructor()"]
    B --> C["Init pointers"]
    C --> D["onDeployment()"]
    D --> E["Set initial state"]
    E --> F["Contract Ready"]
```

### Execution Phase (Every Call)

```mermaid
---
config:
  theme: dark
---
flowchart LR
    A["👤 User calls"] --> B["constructor()"]
    B --> C["onExecutionStarted()"]
    C --> D["execute(selector)"]
    D --> E{"Match?"}
    E -->|"Yes"| F["Method handler"]
    E -->|"No"| G["super.execute()"]
    F --> H["Business logic"]
    G --> H
    H --> I["onExecutionCompleted()"]
    I --> J["Return result"]
```

```mermaid
---
config:
  theme: dark
---
classDiagram
    class OP_NET {
        <<abstract>>
        +constructor()
        +onDeployment(calldata) void
        +execute(method, calldata) BytesWriter
        +onExecutionStarted(method) void
        +onExecutionCompleted(method) void
        +emitEvent(event) void
    }

    class OP20 {
        Fungible Token
        +transfer(calldata) BytesWriter
        +approve(calldata) BytesWriter
    }

    class OP721 {
        NFT
        +transferFrom(calldata) BytesWriter
        +mint(to, tokenId) void
    }

    OP_NET <|-- OP20
    OP_NET <|-- OP721
```

### Method Execution Sequence

```mermaid
---
config:
  theme: dark
---
sequenceDiagram
    participant User as 👤 User
    participant VM as Runtime
    participant Contract
    participant Storage

    User->>VM: Call contract
    VM->>Contract: constructor()
    VM->>Contract: onExecutionStarted()
    VM->>Contract: execute(selector, calldata)
    Contract->>Storage: Read/Write state
    Contract->>VM: Return result
    VM->>Contract: onExecutionCompleted()
    VM->>User: Transaction receipt
```

### 1. Construction

The constructor runs on **every** contract interaction:

```typescript
public constructor() {
    super();  // Always call parent constructor

    // Initialize storage maps (these run every time)
    this.balances = new AddressMemoryMap(this.balancesPointer);

    // DON'T do one-time initialization here!
}
```

**Key Difference from Solidity:**

| Solidity | OPNet |
|----------|-------|
| Constructor runs once at deployment | Constructor runs every call |
| Initialize state in constructor | Initialize state in `onDeployment` |

### 2. Deployment (onDeployment)

Runs exactly **once** when the contract is first deployed:

```typescript
public override onDeployment(calldata: Calldata): void {
    // Read deployment parameters
    const initialSupply = calldata.readU256();
    const tokenName = calldata.readString();

    // Set initial state
    this._totalSupply.value = initialSupply;
    this._name.value = tokenName;

    // Mint initial tokens
    this._mint(Blockchain.tx.origin, initialSupply);
}
```

### 3. Method Execution (execute)

Routes incoming calls to the appropriate method:

```typescript
// Define method selectors
const TRANSFER_SELECTOR: u32 = encodeSelector('transfer');
const APPROVE_SELECTOR: u32 = encodeSelector('approve');
const BALANCE_OF_SELECTOR: u32 = encodeSelector('balanceOf');

public override execute(method: Selector, calldata: Calldata): BytesWriter {
    switch (method) {
        case TRANSFER_SELECTOR:
            return this.transfer(calldata);
        case APPROVE_SELECTOR:
            return this.approve(calldata);
        case BALANCE_OF_SELECTOR:
            return this.balanceOf(calldata);
        default:
            // Let parent handle built-in methods or throw
            return super.execute(method, calldata);
    }
}
```

## Method Selectors

Methods are identified by selectors (4-byte identifiers):

```typescript
import { Selector, encodeSelector } from '@btc-vision/btc-runtime/runtime';

// Define selector constants (sha256 first 4 bytes of method signature)
const TRANSFER_SELECTOR: u32 = encodeSelector('transfer');

// Compare in execute()
if (method === TRANSFER_SELECTOR) {
    return this.transfer(calldata);
}
```

### Solidity Comparison

```solidity
// Solidity: Automatic selector generation
function transfer(address to, uint256 amount) public { }
// Selector: keccak256("transfer(address,uint256)")[:4]

// OPNet: Explicit selector routing
const TRANSFER_SELECTOR: u32 = encodeSelector('transfer');
case TRANSFER_SELECTOR:
    return this.transfer(calldata);
```

## Access Control

### onlyDeployer

Restrict function access to the contract deployer:

```typescript
@method({ name: 'parameter', type: ABIDataTypes.UINT256 })
public adminFunction(calldata: Calldata): BytesWriter {
    this.onlyDeployer(Blockchain.tx.sender);

    // Only deployer reaches here
    return new BytesWriter(0);
}
```

### Custom Access Control

```typescript
private adminPointer: u16 = Blockchain.nextPointer;
private admin: StoredAddress = new StoredAddress(this.adminPointer, Address.zero());

private onlyAdmin(): void {
    if (!Blockchain.tx.sender.equals(this.admin.value)) {
        throw new Revert('Caller is not admin');
    }
}

@method({ name: 'value', type: ABIDataTypes.UINT256 })
public setParameter(calldata: Calldata): BytesWriter {
    this.onlyAdmin();
    // ...
}
```

## Event Emission

Emit events to notify off-chain systems:

```typescript
import { NetEvent, TransferEvent } from '@btc-vision/btc-runtime/runtime';

// Using built-in events
this.emitEvent(new TransferEvent(from, to, amount));

// Using custom events
this.emitEvent(new MyCustomEvent(data1, data2));
```

## Storage Patterns

### Pointer Allocation

```typescript
export class MyContract extends OP_NET {
    // Allocate storage pointers at class level
    private counterPointer: u16 = Blockchain.nextPointer;
    private ownerPointer: u16 = Blockchain.nextPointer;
    private dataPointer: u16 = Blockchain.nextPointer;

    // Create storage instances
    private counter: StoredU256 = new StoredU256(this.counterPointer, EMPTY_POINTER);
    private owner: StoredAddress = new StoredAddress(this.ownerPointer, Address.zero());
}
```

### Storage Maps

```typescript
export class MyContract extends OP_NET {
    private balancesPointer: u16 = Blockchain.nextPointer;
    private balances: AddressMemoryMap;

    public constructor() {
        super();
        // Initialize maps in constructor (runs every time, but that's OK)
        this.balances = new AddressMemoryMap(this.balancesPointer);
    }
}
```

## Complete Example

```typescript
import { u256 } from '@btc-vision/as-bignum/assembly';
import {
    OP_NET,
    Blockchain,
    Address,
    Calldata,
    BytesWriter,
    Selector,
    StoredU256,
    StoredAddress,
    AddressMemoryMap,
    SafeMath,
    Revert,
    ABIDataTypes,
    encodeSelector,
} from '@btc-vision/btc-runtime/runtime';

// Define method selectors (sha256 first 4 bytes of method signature)
const TRANSFER_SELECTOR: u32 = encodeSelector('transfer');
const BALANCE_OF_SELECTOR: u32 = encodeSelector('balanceOf');
const TOTAL_SUPPLY_SELECTOR: u32 = encodeSelector('totalSupply');

@final
export class SimpleToken extends OP_NET {
    // Storage pointers
    private totalSupplyPointer: u16 = Blockchain.nextPointer;
    private balancesPointer: u16 = Blockchain.nextPointer;

    // Storage
    private _totalSupply: StoredU256 = new StoredU256(this.totalSupplyPointer, EMPTY_POINTER);
    private balances: AddressMemoryMap;

    public constructor() {
        super();
        this.balances = new AddressMemoryMap(this.balancesPointer);
    }

    public override onDeployment(calldata: Calldata): void {
        const initialSupply = calldata.readU256();

        this._totalSupply.value = initialSupply;
        this.balances.set(Blockchain.tx.origin, initialSupply);
    }

    public override execute(method: Selector, calldata: Calldata): BytesWriter {
        switch (method) {
            case TRANSFER_SELECTOR:
                return this.transfer(calldata);
            case BALANCE_OF_SELECTOR:
                return this.balanceOfMethod(calldata);
            case TOTAL_SUPPLY_SELECTOR:
                return this.totalSupplyMethod(calldata);
            default:
                return super.execute(method, calldata);
        }
    }

    private transfer(calldata: Calldata): BytesWriter {
        const to = calldata.readAddress();
        const amount = calldata.readU256();
        const from = Blockchain.tx.sender;

        // Validation
        if (to.equals(Address.zero())) {
            throw new Revert('Cannot transfer to zero address');
        }

        // Get balances
        const fromBalance = this.balances.get(from);
        if (fromBalance < amount) {
            throw new Revert('Insufficient balance');
        }

        // Update balances
        this.balances.set(from, SafeMath.sub(fromBalance, amount));
        this.balances.set(to, SafeMath.add(this.balances.get(to), amount));

        return new BytesWriter(0);
    }

    private balanceOfMethod(calldata: Calldata): BytesWriter {
        const address = calldata.readAddress();
        const balance = this.balances.get(address);

        const writer = new BytesWriter(32);
        writer.writeU256(balance);
        return writer;
    }

    private totalSupplyMethod(_calldata: Calldata): BytesWriter {
        const writer = new BytesWriter(32);
        writer.writeU256(this._totalSupply.value);
        return writer;
    }
}
```

## Inheritance

### Extending OP_NET

```typescript
// Direct extension
export class MyContract extends OP_NET { }

// Extend with additional features
export class MyToken extends OP20 { }  // OP20 extends OP_NET
export class MyNFT extends OP721 { }   // OP721 extends OP_NET
```

### Adding Functionality

```typescript
// Create a base class with shared functionality
export abstract class Pausable extends OP_NET {
    private pausedPointer: u16 = Blockchain.nextPointer;
    protected _paused: StoredBoolean = new StoredBoolean(this.pausedPointer, false);

    protected whenNotPaused(): void {
        if (this._paused.value) {
            throw new Revert('Contract is paused');
        }
    }
}

// Use in your contract
export class MyToken extends Pausable {
    @method(
        { name: 'to', type: ABIDataTypes.ADDRESS },
        { name: 'amount', type: ABIDataTypes.UINT256 },
    )
    @emit('Transfer')
    public transfer(calldata: Calldata): BytesWriter {
        this.whenNotPaused();
        // ...
    }
}
```

## Best Practices

### 1. Always Use @final

```typescript
@final  // Prevents further inheritance, enables optimizations
export class MyContract extends OP_NET { }
```

### 2. Call super() in Constructor

```typescript
public constructor() {
    super();  // Always first!
    // Then your initialization...
}
```

### 3. Handle Unknown Methods

```typescript
public override execute(method: Selector, calldata: Calldata): BytesWriter {
    switch (method) {
        // Your methods...
        default:
            return super.execute(method, calldata);  // Let parent handle or throw
    }
}
```

### 4. Document Your Methods

```typescript
/**
 * Transfers tokens from sender to recipient.
 * @param calldata Contains: to (Address), amount (u256)
 * @returns Empty BytesWriter on success
 * @throws Revert if insufficient balance or zero address
 */
private transfer(calldata: Calldata): BytesWriter {
    // ...
}
```

---

**Navigation:**
- Previous: [Security](../core-concepts/security.md)
- Next: [OP20 Token](./op20-token.md)
