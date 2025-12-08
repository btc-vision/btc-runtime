# Storage System

OPNet uses a pointer-based storage system that provides deterministic, secure, and efficient data persistence on Bitcoin L1. This guide explains how storage works and how to use it effectively.

## Overview

Unlike Solidity where storage is implicitly managed, OPNet requires explicit pointer allocation for all persistent data. This design provides:

- **Deterministic storage locations** via SHA256 hashing
- **Collision-free addressing** through unique pointer combinations
- **Gas-efficient access** with optimized read/write patterns
- **Verifiable state proofs** for cross-chain validation

```mermaid
flowchart TB
    subgraph Solidity["Solidity (Implicit)"]
        SOL1["uint256 totalSupply"] --> SLOT0["Slot 0 implicit"]
        SOL2["mapping balances"] --> SLOT1["Slot 1 implicit"]
        SOL3["mapping allowances"] --> SLOT2["Slot 2 implicit"]
    end
    
    subgraph OPNet["OPNet (Explicit)"]
        OP1["totalSupplyPointer = nextPointer"] --> PTR0["Pointer 0 explicit"]
        OP2["balancesPointer = nextPointer"] --> PTR1["Pointer 1 explicit"]
        OP3["allowancesPointer = nextPointer"] --> PTR2["Pointer 2 explicit"]
    end
```

## How Storage Works

### Storage Keys

Every storage location is identified by a unique key generated from:

```
StorageKey = SHA256(pointer || subPointer)
```

Where:
- `pointer` is a `u16` (0-65535) identifying the storage slot type
- `subPointer` is a `u256` for sub-indexing (e.g., addresses in a mapping)

```mermaid
flowchart LR
    A[pointer u16] --> C[SHA256]
    B[subPointer u256] --> C
    C --> D[StorageKey]
    
    E["pointer = 3"] --> G["SHA256(3 || 0xABC...)"]
    F["subPointer = 0xABC..."] --> G
    G --> H["Unique Storage Location"]
```

```typescript
// Example: Balance storage for address 0xABC...
pointer = 3              // balances mapping pointer
subPointer = 0xABC...    // the address
storageKey = SHA256(3 || 0xABC...)
```

### Storage Layout

```mermaid
flowchart TD
    CS[Contract Storage] --> P0["Pointer 0: totalSupply"]
    CS --> P1["Pointer 1: name"]
    CS --> P2["Pointer 2: symbol"]
    CS --> P3["Pointer 3: balances mapping"]
    CS --> P4["Pointer 4: allowances mapping"]
    
    P3 --> S1["subPointer 0xAAA → balance"]
    P3 --> S2["subPointer 0xBBB → balance"]
    P3 --> S3["..."]
    
    P4 --> N1["owner+spender hash → allowance"]
```

## Pointer Allocation

### Allocating Pointers

Use `Blockchain.nextPointer` to allocate unique pointers:

```typescript
import { Blockchain } from '@btc-vision/btc-runtime/runtime';

@final
export class MyContract extends OP_NET {
    // Each call to nextPointer returns a unique u16
    private totalSupplyPointer: u16 = Blockchain.nextPointer;
    private namePointer: u16 = Blockchain.nextPointer;
    private balancesPointer: u16 = Blockchain.nextPointer;
    private allowancesPointer: u16 = Blockchain.nextPointer;

    // ...
}
```

```mermaid
sequenceDiagram
    participant Contract
    participant Blockchain
    
    Contract->>Blockchain: nextPointer
    Blockchain-->>Contract: 0 (totalSupply)
    Contract->>Blockchain: nextPointer
    Blockchain-->>Contract: 1 (name)
    Contract->>Blockchain: nextPointer
    Blockchain-->>Contract: 2 (balances)
    Contract->>Blockchain: nextPointer
    Blockchain-->>Contract: 3 (allowances)
```

### Solidity Comparison

| Solidity | OPNet |
|----------|-------|
| Implicit slot numbers | Explicit pointer allocation |
| `uint256 public totalSupply;` (slot 0) | `totalSupplyPointer: u16 = Blockchain.nextPointer;` |
| `mapping(address => uint256) balances;` (slot 1) | `balancesPointer: u16 = Blockchain.nextPointer;` |

## Storage Types

OPNet provides typed storage classes for common data types:

### Primitive Storage

```typescript
import {
    StoredU256,
    StoredU128,
    StoredU64,
    StoredU32,
    StoredU16,
    StoredU8,
    StoredBoolean,
    StoredString,
    StoredAddress,
    EMPTY_POINTER,
} from '@btc-vision/btc-runtime/runtime';

// Usage
private totalSupplyPointer: u16 = Blockchain.nextPointer;
private _totalSupply: StoredU256 = new StoredU256(
    this.totalSupplyPointer,
    EMPTY_POINTER
);

// Read value
const supply = this._totalSupply.value;

// Write value
this._totalSupply.value = newSupply;
```

### Array Storage

```typescript
import {
    ABIDataTypes,
    BytesWriter,
    Calldata,
    StoredU256Array,
    StoredU128Array,
    StoredAddressArray,
    StoredBooleanArray,
} from '@btc-vision/btc-runtime/runtime';

// Usage
private holdersPointer: u16 = Blockchain.nextPointer;
private holders: StoredAddressArray = new StoredAddressArray(this.holdersPointer);

// Operations
@method({ name: 'holder', type: ABIDataTypes.ADDRESS })
public addHolder(calldata: Calldata): BytesWriter {
    const newHolder = calldata.readAddress();
    this.holders.push(newHolder);
    return new BytesWriter(0);
}

const holder = this.holders.get(index);
const length = this.holders.length;
this.holders.pop();
```

### Map Storage

```typescript
import { u256 } from '@btc-vision/as-bignum/assembly';
import {
    Address,
    StoredMapU256,
    AddressMemoryMap,
} from '@btc-vision/btc-runtime/runtime';

// Simple mapping
private balancesPointer: u16 = Blockchain.nextPointer;
private balances: StoredMapU256 = new StoredMapU256(this.balancesPointer);

// Address-keyed mapping (default value is u256.Zero)
private balanceMap: AddressMemoryMap;

public constructor() {
    super();
    this.balanceMap = new AddressMemoryMap(this.balancesPointer);
}
```

## Storage Patterns

### Simple Value

```typescript
import { u256 } from '@btc-vision/as-bignum/assembly';
import {
    Blockchain,
    SafeMath,
    StoredU256,
} from '@btc-vision/btc-runtime/runtime';

// Solidity: uint256 public counter;
private counterPointer: u16 = Blockchain.nextPointer;
private counter: StoredU256 = new StoredU256(this.counterPointer, EMPTY_POINTER);

// Increment
this.counter.value = SafeMath.add(this.counter.value, u256.One);
```

### Mapping (address => uint256)

```typescript
import { u256 } from '@btc-vision/as-bignum/assembly';
import {
    ABIDataTypes,
    Address,
    AddressMemoryMap,
    SafeMath,
} from '@btc-vision/btc-runtime/runtime';

// Solidity: mapping(address => uint256) public balances;
private balancesPointer: u16 = Blockchain.nextPointer;
private balanceOf: AddressMemoryMap;

public constructor() {
    super();
    this.balanceOf = new AddressMemoryMap(this.balancesPointer);
}

// Get balance
@method({ name: 'address', type: ABIDataTypes.ADDRESS })
@returns({ name: 'balance', type: ABIDataTypes.UINT256 })
public getBalance(address: Address): u256 {
    return this.balanceOf.get(address);
}

// Set balance (using SafeMath for operations)
@method(
    { name: 'address', type: ABIDataTypes.ADDRESS },
    { name: 'amount', type: ABIDataTypes.UINT256 }
)
public setBalance(address: Address, amount: u256): void {
    this.balanceOf.set(address, amount);
}
```

### Nested Mapping (address => address => uint256)

For nested mappings like allowances, you need to derive a composite key by hashing both addresses together.

```mermaid
flowchart LR
    O[owner address 32 bytes] --> C[Concatenate]
    S[spender address 32 bytes] --> C
    C --> H["SHA256(owner || spender)"]
    H --> SP[subPointer u256]
    P[allowancesPointer u16] --> E["encodePointer(ptr, subPtr)"]
    SP --> E
    E --> F[Final Storage Key]
```

```typescript
import { u256 } from '@btc-vision/as-bignum/assembly';
import {
    ABIDataTypes,
    Address,
    encodePointer,
} from '@btc-vision/btc-runtime/runtime';

// Solidity: mapping(address => mapping(address => uint256)) public allowances;
// For nested mappings, use composite storage keys with helper methods
private allowancesPointer: u16 = Blockchain.nextPointer;

// Getting nested value using composite key
@method(
    { name: 'owner', type: ABIDataTypes.ADDRESS },
    { name: 'spender', type: ABIDataTypes.ADDRESS }
)
@returns({ name: 'allowance', type: ABIDataTypes.UINT256 })
public getAllowance(owner: Address, spender: Address): u256 {
    const subPointer = this.computeAllowanceKey(owner, spender);
    const pointerHash = encodePointer(this.allowancesPointer, subPointer.toUint8Array(true));
    const stored = Blockchain.getStorageAt(pointerHash);
    return u256.fromUint8ArrayBE(stored);
}

private computeAllowanceKey(owner: Address, spender: Address): u256 {
    const combined = new Uint8Array(64);
    combined.set(owner.toBytes(), 0);
    combined.set(spender.toBytes(), 32);
    return u256.fromBytes(Blockchain.sha256(combined));
}
```

### Struct-like Storage

```typescript
// Solidity:
// struct User { address addr; uint256 balance; bool active; }
// mapping(uint256 => User) public users;

// OPNet: Use multiple pointers or encode into u256
private userAddressPointer: u16 = Blockchain.nextPointer;
private userBalancePointer: u16 = Blockchain.nextPointer;
private userActivePointer: u16 = Blockchain.nextPointer;

private userAddresses: StoredMapU256 = new StoredMapU256(this.userAddressPointer);
private userBalances: StoredMapU256 = new StoredMapU256(this.userBalancePointer);
private userActives: StoredMapU256 = new StoredMapU256(this.userActivePointer);
```

## Reading and Writing

```mermaid
flowchart TD
    subgraph Read
        R1[Get pointer + subPointer] --> R2[Compute SHA256 key]
        R2 --> R3[Blockchain.getStorageAt]
        R3 --> R4[Decode to typed value]
    end
    
    subgraph Write
        W1[Get pointer + subPointer] --> W2[Compute SHA256 key]
        W2 --> W3[Encode typed value]
        W3 --> W4[Buffer in memory]
        W4 --> W5[Commit on tx complete]
    end
```

### Read Operations

```typescript
// Read primitive
const value = this._totalSupply.value;

// Read from map
const balance = this.balanceOf.get(address);

// Read from array
const holder = this.holders.get(index);
const length = this.holders.length;
```

### Write Operations

```typescript
// Write primitive
this._totalSupply.value = newValue;

// Write to map
this.balanceOf.set(address, newBalance);

// Write to array
this.holders.push(newAddress);
this.holders.set(index, address);
```

### Commit Optimization

For complex operations, delay commits until necessary:

```typescript
import { SafeMath } from '@btc-vision/btc-runtime/runtime';

// Multiple operations without intermediate commits
const currentBalance = this.balanceOf.get(from);
const newBalance = SafeMath.sub(currentBalance, amount);
this.balanceOf.set(from, newBalance);  // Value is buffered

// Changes are committed when transaction completes
```

## Default Values

Always provide sensible defaults:

```typescript
// u256 with EMPTY_POINTER
private balance: StoredU256 = new StoredU256(pointer, EMPTY_POINTER);

// String with index 0
private name: StoredString = new StoredString(pointer, 0);

// Boolean with false default
private paused: StoredBoolean = new StoredBoolean(pointer, false);
```

## Storage Limits

| Limit | Value | Notes |
|-------|-------|-------|
| Pointers per contract | 65,535 | `u16` range |
| Array length | 65,535 | Hard limit per array |
| String length | Variable | Encoded in storage |
| Sub-pointers | `u256` range | Effectively unlimited |

## Best Practices

### 1. Allocate Pointers in Order

```typescript
// Good: Sequential allocation
private ptr1: u16 = Blockchain.nextPointer;
private ptr2: u16 = Blockchain.nextPointer;
private ptr3: u16 = Blockchain.nextPointer;

// Bad: Gaps or manual assignment
private ptr1: u16 = 0;
private ptr2: u16 = 5;  // Gap!
```

### 2. Use Typed Storage

```typescript
// Good: Type-safe storage
private balance: StoredU256 = new StoredU256(ptr, EMPTY_POINTER);

// Avoid: Raw storage access (only for special cases)
import { encodePointer } from '@btc-vision/btc-runtime/runtime';
const pointerHash = encodePointer(ptr, subPtr);
Blockchain.setStorageAt(pointerHash, value);
```

### 3. Initialize in Constructor or onDeployment

```typescript
import { u256 } from '@btc-vision/as-bignum/assembly';
import {
    Address,
    AddressMemoryMap,
    Blockchain,
    Calldata,
    OP_NET,
} from '@btc-vision/btc-runtime/runtime';

export class MyContract extends OP_NET {
    private balancesPointer: u16 = Blockchain.nextPointer;
    private balanceOf: AddressMemoryMap;

    public constructor() {
        super();
        // Initialize storage maps in constructor
        this.balanceOf = new AddressMemoryMap(this.balancesPointer);
    }

    public override onDeployment(calldata: Calldata): void {
        // Set initial values here
        this._totalSupply.value = initialSupply;
    }
}
```

### 4. Consider Gas Costs

```mermaid
flowchart TD
    subgraph Bad["Expensive: Multiple Reads"]
        B1[Loop iteration 1] --> BR1[Storage read]
        B2[Loop iteration 2] --> BR2[Storage read]
        B3[Loop iteration N] --> BR3[Storage read]
    end
    
    subgraph Good["Optimized: Cache Once"]
        G1[Single storage read] --> G2[Cache in memory]
        G2 --> G3[Loop uses cached value]
        G3 --> G4[Single write if needed]
    end
```

```typescript
import { SafeMath } from '@btc-vision/btc-runtime/runtime';

// Expensive: Reading same value multiple times
for (let i = 0; i < 100; i++) {
    const balance = this.balanceOf.get(address);  // Storage read each time
    // ...
}

// Better: Cache the value
const balance = this.balanceOf.get(address);  // One storage read
for (let i = 0; i < 100; i++) {
    // Use cached balance
    // When modifying, use SafeMath
    const updated = SafeMath.add(balance, u256.One);
}
```

## Transient Storage

For temporary data that doesn't persist between transactions:

```typescript
// Transient storage is cleared after each transaction
// Useful for reentrancy guards, temporary calculations, etc.
```

See [Advanced Storage](../storage/stored-primitives.md) for transient storage details.

---

**Navigation:**
- Previous: [Blockchain Environment](./blockchain-environment.md)
- Next: [Pointers](./pointers.md)
