# Storage System

OPNet uses a pointer-based storage system that provides deterministic, secure, and efficient data persistence on Bitcoin L1. This guide explains how storage works and how to use it effectively.

## Overview

Unlike Solidity where storage is implicitly managed, OPNet requires explicit pointer allocation for all persistent data. This design provides:

- **Deterministic storage locations** via SHA256 hashing
- **Collision-free addressing** through unique pointer combinations
- **Gas-efficient access** with optimized read/write patterns
- **Verifiable state proofs** for cross-chain validation

## System Architecture

```mermaid
flowchart TB
    subgraph UserLayer["User Layer"]
        USER[("👤 User")]
    end

    subgraph BitcoinL1["Bitcoin L1"]
        BTC_TX["Bitcoin Transaction"]
        BTC_BLOCK["Bitcoin Block"]
        UTXO["UTXOs"]
    end

    subgraph OPNetConsensus["OPNet Consensus Layer"]
        INDEXER["OPNet Nodes"]
        WASM["WASM Runtime"]
        EPOCH["Epoch Mining<br/>SHA1 PoW"]
        CHECKPOINT["State Checksum<br/>Root Hash"]
    end

    subgraph Contract["Smart Contract"]
        ENTRY["Contract Entry Point"]
        LOGIC["Business Logic"]
        VERIFY["Output Verification<br/>blockchain.tx.outputs"]
        PTR_ALLOC["Pointer Allocation<br/>Blockchain.nextPointer"]
    end

    subgraph StorageSystem["Storage System"]
        direction TB
        PTR["Pointer (u16)<br/>0-65535 slots"]
        SUBPTR["SubPointer (u256)<br/>mapping keys"]
        HASH["SHA256(ptr || subPtr)"]
        STORAGE[("Persistent State<br/>Key-Value Store")]
        
        PTR --> HASH
        SUBPTR --> HASH
        HASH --> STORAGE
    end

    USER -->|"Signs & Broadcasts"| BTC_TX
    BTC_TX -->|"Included in"| BTC_BLOCK
    BTC_BLOCK -->|"Parsed by"| INDEXER
    INDEXER -->|"Executes in"| WASM
    WASM -->|"Runs"| ENTRY
    ENTRY --> LOGIC
    LOGIC -->|"Non-custodial verify"| VERIFY
    LOGIC -->|"Allocates"| PTR_ALLOC
    PTR_ALLOC -->|"Returns u16"| PTR
    LOGIC -->|"Read/Write"| STORAGE
    
    INDEXER -->|"Every 20 blocks"| EPOCH
    EPOCH -->|"Produces"| CHECKPOINT
    CHECKPOINT -->|"Anchors to"| BTC_BLOCK
    
    VERIFY -->|"Validates"| UTXO
    BTC_TX -->|"Creates/Spends"| UTXO
```

## Solidity vs OPNet Storage Model

```mermaid
flowchart TB
    subgraph SolidityFlow["Solidity (Ethereum)"]
        direction TB
        S_USER[("👤 User")] -->|"Sends ETH + calldata"| S_TX["Ethereum Transaction"]
        S_TX -->|"EVM executes"| S_CONTRACT["Smart Contract"]
        
        subgraph S_Storage["Storage (Implicit)"]
            S_COMPILER["Compiler assigns slots<br/>at compile time"]
            S_SLOT0["Slot 0: totalSupply"]
            S_SLOT1["Slot 1: balances"]
            S_SLOT2["Slot 2: allowances"]
            S_COMPILER -.->|"Hidden from dev"| S_SLOT0
            S_COMPILER -.->|"Hidden from dev"| S_SLOT1
            S_COMPILER -.->|"Hidden from dev"| S_SLOT2
        end
        
        S_CONTRACT -->|"keccak256(slot.key)"| S_Storage
        S_CONTRACT -->|"CAN hold ETH"| S_CUSTODY["Contract Custody<br/>address(this).balance"]
    end

    subgraph OPNetFlow["OPNet (Bitcoin L1)"]
        direction TB
        O_USER[("👤 User")] -->|"Signs Bitcoin TX"| O_TX["Bitcoin Transaction"]
        O_TX -->|"WASM executes"| O_CONTRACT["Smart Contract"]
        
        subgraph O_Storage["Storage (Explicit)"]
            O_RUNTIME["Runtime allocates ptrs<br/>at execution time"]
            O_PTR0["Pointer 0: totalSupplyPointer"]
            O_PTR1["Pointer 1: balancesPointer"]
            O_PTR2["Pointer 2: allowancesPointer"]
            O_RUNTIME -->|"Dev controls"| O_PTR0
            O_RUNTIME -->|"Dev controls"| O_PTR1
            O_RUNTIME -->|"Dev controls"| O_PTR2
        end
        
        O_CONTRACT -->|"SHA256(ptr || subPtr)"| O_Storage
        O_CONTRACT -->|"CANNOT hold BTC"| O_VERIFY["Verify-Only Pattern<br/>blockchain.tx.outputs"]
        O_VERIFY -->|"Validates"| O_TX
    end

    subgraph KeyDiff["Critical Differences"]
        DIFF1["Custody: Solidity holds funds,<br/>OPNet verifies outputs"]
        DIFF2["Storage: Solidity implicit slots,<br/>OPNet explicit pointers"]
        DIFF3["Hash: Solidity keccak256,<br/>OPNet SHA256"]
        DIFF4["Execution: Solidity EVM,<br/>OPNet WASM"]
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

### Storage Key Structure

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

```typescript
// Example: Balance storage for address 0xABC...
pointer = 3              // balances mapping pointer
subPointer = 0xABC...    // the address
storageKey = SHA256(3 || 0xABC...)
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

### Storage Key Derivation Flow

```mermaid
flowchart LR
    subgraph Input["Developer Input"]
        DEV["Contract Code"]
        DEV -->|"Declares"| VAR1["totalSupplyPointer: u16"]
        DEV -->|"Declares"| VAR2["balancesPointer: u16"]
    end

    subgraph Allocation["Runtime Allocation"]
        BC["Blockchain.nextPointer"]
        VAR1 -->|"Calls"| BC
        VAR2 -->|"Calls"| BC
        BC -->|"Returns 0"| P0["Pointer 0"]
        BC -->|"Returns 1"| P1["Pointer 1"]
    end

    subgraph SimpleKey["Simple Value Key"]
        P0 --> EMPTY["EMPTY_POINTER<br/>(u256.Zero)"]
        EMPTY --> HASH1["SHA256(0 || 0x00...00)"]
        HASH1 --> KEY1[("Storage Key<br/>for totalSupply")]
    end

    subgraph MappingKey["Mapping Key (balances)"]
        P1 --> ADDR["User Address<br/>0xABC..."]
        ADDR --> HASH2["SHA256(1 || 0xABC...)"]
        HASH2 --> KEY2[("Storage Key<br/>for balances[0xABC]")]
    end

    subgraph NestedKey["Nested Mapping (allowances)"]
        P2["Pointer 2"] --> OWNER["Owner: 0xAAA..."]
        P2 --> SPENDER["Spender: 0xBBB..."]
        OWNER --> CONCAT["Concatenate 64 bytes"]
        SPENDER --> CONCAT
        CONCAT --> INNER["SHA256(owner || spender)"]
        INNER --> SUBPTR["SubPointer (u256)"]
        SUBPTR --> HASH3["SHA256(2 || subPtr)"]
        HASH3 --> KEY3[("Storage Key<br/>for allowances[owner][spender]")]
    end
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

```mermaid
sequenceDiagram
    participant User
    participant Bitcoin as Bitcoin L1
    participant OPNet as OPNet Node
    participant WASM as WASM Runtime
    participant Contract
    participant Blockchain as Blockchain API
    participant Storage as Storage System

    User->>Bitcoin: Broadcast Transaction
    Bitcoin->>OPNet: New Block with TX
    OPNet->>WASM: Execute Contract
    WASM->>Contract: Instantiate
    Contract->>Blockchain: nextPointer
    Blockchain-->>Contract: 0 (totalSupply)
    Contract->>Blockchain: nextPointer
    Blockchain-->>Contract: 1 (name)
    Contract->>Blockchain: nextPointer
    Blockchain-->>Contract: 2 (balances)
    Contract->>Blockchain: nextPointer
    Blockchain-->>Contract: 3 (allowances)
    Contract->>Storage: Read/Write with pointers
    Storage-->>Contract: Data
    Contract-->>WASM: Execution Result
    WASM-->>OPNet: State Changes
    OPNet->>OPNet: Update State Root
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

### Read/Write Flow Diagram

```mermaid
flowchart TD
    subgraph Transaction["Bitcoin Transaction"]
        TX_IN["TX Input<br/>(User Signs)"]
        TX_OUT["TX Outputs<br/>(UTXOs)"]
    end

    subgraph Contract["Contract Execution"]
        CALL["Method Call"]
        LOGIC["Business Logic"]
    end

    subgraph ReadFlow["Read Flow"]
        R1["Get pointer + subPointer"]
        R2["Compute SHA256 key"]
        R3["Blockchain.getStorageAt"]
        R4["Decode to typed value"]
        R1 --> R2 --> R3 --> R4
    end

    subgraph WriteFlow["Write Flow"]
        W1["Get pointer + subPointer"]
        W2["Compute SHA256 key"]
        W3["Encode typed value"]
        W4["Buffer in memory"]
        W5["Commit on TX complete"]
        W1 --> W2 --> W3 --> W4 --> W5
    end

    subgraph StateCommit["State Commitment"]
        BUFFER["Memory Buffer"]
        STATE["Persistent State"]
        CHECKSUM["State Checksum"]
        EPOCH["Epoch Root"]
    end

    TX_IN -->|"Triggers"| CALL
    CALL --> LOGIC
    LOGIC -->|"Reads"| ReadFlow
    LOGIC -->|"Writes"| WriteFlow
    LOGIC -->|"Verifies"| TX_OUT
    
    W5 --> BUFFER
    BUFFER -->|"TX Success"| STATE
    STATE --> CHECKSUM
    CHECKSUM -->|"Every 20 blocks"| EPOCH
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
    subgraph Bad["Expensive: Multiple Storage Reads"]
        LOOP1["for (i = 0; i < 100; i++)"]
        LOOP1 --> READ1["Storage Read #1"]
        LOOP1 --> READ2["Storage Read #2"]
        LOOP1 --> READ3["Storage Read #..."]
        LOOP1 --> READ100["Storage Read #100"]
        READ1 --> COST1["100x Storage I/O Cost"]
        READ2 --> COST1
        READ3 --> COST1
        READ100 --> COST1
    end

    subgraph Good["Optimized: Cache and Batch"]
        CACHE["Single Storage Read"]
        CACHE --> MEM["Cache in Memory"]
        MEM --> LOOP2["for (i = 0; i < 100; i++)<br/>Use cached value"]
        LOOP2 --> WRITE["Single Storage Write"]
        WRITE --> COST2["1x Read + 1x Write"]
    end

    COST1 -->|"vs"| COST2
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

## State Finality and Security

```mermaid
flowchart TB
    subgraph Execution["Transaction Execution"]
        TX["Bitcoin Transaction"]
        EXEC["WASM Execution"]
        STATE["State Changes"]
        TX --> EXEC --> STATE
    end

    subgraph Consensus["OPNet Consensus"]
        NODES["OPNet Nodes"]
        VERIFY["Verify Execution"]
        CHECKSUM["Compute State Checksum"]
        NODES --> VERIFY --> CHECKSUM
    end

    subgraph Finality["State Finality"]
        EPOCH["Epoch (20 blocks)"]
        SHA1["SHA1 Mining"]
        ROOT["Epoch Root Hash"]
        ANCHOR["Anchored to Bitcoin"]
        EPOCH --> SHA1 --> ROOT --> ANCHOR
    end

    subgraph Security["Security Properties"]
        S1["Single bit change =<br/>Complete checksum change"]
        S2["After 20 blocks =<br/>Rewrite requires millions $/hr"]
        S3["State proofs =<br/>Cryptographically verifiable"]
    end

    STATE --> NODES
    CHECKSUM --> EPOCH
    ANCHOR --> Security
```

---

**Navigation:**
- Previous: [Blockchain Environment](./blockchain-environment.md)
- Next: [Pointers](./pointers.md)
