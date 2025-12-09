# Storage System

OPNet uses a pointer-based storage system that provides deterministic, secure, and efficient data persistence on Bitcoin L1. This guide explains how storage works and how to use it effectively.

## Overview

Unlike Solidity where storage is implicitly managed, OPNet requires explicit pointer allocation for all persistent data. This design provides:

- **Deterministic storage locations** via SHA256 hashing
- **Collision-free addressing** through unique pointer combinations
- **Gas-efficient access** with optimized read/write patterns
- **Verifiable state proofs** for cross-chain validation

## How Storage Works

### Storage Keys

Every storage location is identified by a unique key generated from:

```
StorageKey = SHA256(pointer || subPointer)
```

Where:
- `pointer` is a `u16` (0-65535) identifying the storage slot type
- `subPointer` is a `u256` for sub-indexing (e.g., addresses in a mapping)

```typescript
// Example: Balance storage for address 0xABC...
pointer = 3              // balances mapping pointer
subPointer = 0xABC...    // the address
storageKey = SHA256(3 || 0xABC...)
```

### Storage Key Structure Diagram

```mermaid
flowchart LR
    A["Pointer (u16)<br/>2 bytes"] --> C["Concatenate<br/>(||)"]
    B["SubPointer (u256)<br/>30 bytes"] --> C
    C --> D["SHA256<br/>Hash Function"]
    D --> E["Storage Key<br/>32 bytes"]

    style A fill:#e1f5fe
    style B fill:#e1f5fe
    style C fill:#fff9c4
    style D fill:#f8bbd0
    style E fill:#c8e6c9
```

### Pointer Encoding Process

```mermaid
flowchart TD
    Start([Contract Needs Storage]) --> Alloc[Allocate Pointer with<br/>Blockchain.nextPointer]
    Alloc --> Create[Create StoredU256/StoredString/etc]
    Create --> Access{Access Type?}

    Access -->|Read| ReadPath[Get pointer + subPointer]
    Access -->|Write| WritePath[Get pointer + subPointer]

    ReadPath --> Encode1[Call encodePointer]
    WritePath --> Encode2[Call encodePointer]

    Encode1 --> Hash1["SHA256(pointer || subPointer)"]
    Encode2 --> Hash2["SHA256(pointer || subPointer)"]

    Hash1 --> GetStorage[Blockchain.getStorageAt]
    Hash2 --> SetStorage[Blockchain.setStorageAt]

    GetStorage --> Decode[Decode to u256/string/etc]
    SetStorage --> Persist[Data persisted to L1]

    Decode --> End1([Return Value])
    Persist --> End2([Storage Updated])

    style Start fill:#e1f5fe
    style Alloc fill:#c8e6c9
    style Create fill:#c8e6c9
    style Access fill:#fff9c4
    style Encode1 fill:#f8bbd0
    style Encode2 fill:#f8bbd0
    style Hash1 fill:#f8bbd0
    style Hash2 fill:#f8bbd0
    style GetStorage fill:#ce93d8
    style SetStorage fill:#ce93d8
    style Persist fill:#a5d6a7
    style End1 fill:#a5d6a7
    style End2 fill:#a5d6a7
```

### Storage Layout

```
Contract Storage
├── Pointer 0: totalSupply
├── Pointer 1: name
├── Pointer 2: symbol
├── Pointer 3: balances[address] → u256
│   ├── subPointer 0xAAA... → balance of 0xAAA
│   ├── subPointer 0xBBB... → balance of 0xBBB
│   └── ...
├── Pointer 4: allowances[owner][spender] → u256
│   └── ...
└── ...
```

## CRITICAL: Map Implementation Warning

> **DO NOT USE AssemblyScript's Built-in Map**
>
> When creating custom map implementations or extending map functionality, you **MUST** use the Map class from `@btc-vision/btc-runtime/runtime`, NOT the built-in AssemblyScript Map.
>
> **Why the AssemblyScript Map is broken for blockchain:**
> - NOT optimized for blockchain storage patterns
> - Does NOT handle Uint8Array buffers as keys correctly
> - Does NOT work properly with Address key comparisons
> - Will cause silent data corruption or key collisions
>
> **CORRECT:**
> ```typescript
> import { Map } from '@btc-vision/btc-runtime/runtime';
>
> export class MyCustomMap<V> extends Map<Address, V> {
>     // Your implementation
> }
> ```
>
> **WRONG:**
> ```typescript
> // DO NOT DO THIS - will break!
> const map = new Map<Uint8Array, u256>();  // AssemblyScript Map
> ```
>
> The btc-runtime Map is specifically designed to:
> - Handle Address and Uint8Array key comparisons correctly
> - Optimize for blockchain storage access patterns
> - Support proper serialization for persistent storage
> - Prevent key collisions with custom equality logic

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

```typescript
import { u256 } from '@btc-vision/as-bignum/assembly';
import {
    ABIDataTypes,
    Address,
    MapOfMap,
    Nested,
} from '@btc-vision/btc-runtime/runtime';

// Solidity: mapping(address => mapping(address => uint256)) public allowances;
private allowancesPointer: u16 = Blockchain.nextPointer;
private allowances: MapOfMap<u256>;

constructor() {
    super();
    this.allowances = new MapOfMap<u256>(this.allowancesPointer);
}

// Getting nested value - two-step process
@method(
    { name: 'owner', type: ABIDataTypes.ADDRESS },
    { name: 'spender', type: ABIDataTypes.ADDRESS }
)
@returns({ name: 'allowance', type: ABIDataTypes.UINT256 })
public getAllowance(owner: Address, spender: Address): u256 {
    const ownerMap = this.allowances.get(owner);  // Returns Nested<u256>
    return ownerMap.get(spender);                  // Returns u256
}

// Setting nested value - get, modify, commit back
protected setAllowance(owner: Address, spender: Address, amount: u256): void {
    const ownerMap = this.allowances.get(owner);
    ownerMap.set(spender, amount);
    this.allowances.set(owner, ownerMap);  // Commit back
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

### Read/Write Operation Sequence

```mermaid
sequenceDiagram
    participant C as Contract Method
    participant S as StoredU256
    participant E as encodePointer()
    participant B as Blockchain
    participant L1 as Bitcoin L1

    Note over C,L1: READ OPERATION
    C->>S: Get value property
    S->>E: Pass pointer + subPointer
    E->>E: SHA256(pointer || subPointer)
    E->>B: getStorageAt(hash)
    B->>L1: Read from storage
    L1-->>B: Raw bytes (32 bytes)
    B-->>S: Return Uint8Array
    S->>S: Decode to u256
    S-->>C: Return value

    Note over C,L1: WRITE OPERATION
    C->>S: Set value property
    S->>S: Encode u256 to bytes
    S->>E: Pass pointer + subPointer
    E->>E: SHA256(pointer || subPointer)
    E->>B: setStorageAt(hash, bytes)
    B->>L1: Write to storage
    L1-->>B: Confirm write
    B-->>S: Success
    S-->>C: Value updated

    Note over C,L1: All changes persist on Bitcoin L1
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
