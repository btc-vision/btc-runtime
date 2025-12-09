# Stored Primitives

Stored primitives are typed wrappers for single values that persist on-chain. They handle storage reading, writing, and caching automatically.

## Overview

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
    Blockchain,
    EMPTY_POINTER,
} from '@btc-vision/btc-runtime/runtime';
import { u256 } from '@btc-vision/as-bignum/assembly';

// Allocate storage pointer
private counterPointer: u16 = Blockchain.nextPointer;

// Create stored value with default
private counter: StoredU256 = new StoredU256(this.counterPointer, EMPTY_POINTER);

// Read and write
const current = this.counter.value;      // Read
this.counter.value = newValue;            // Write
```

## Class Hierarchy

All stored primitives extend the abstract `Stored` base class:

```mermaid
classDiagram
    class Stored {
        <<abstract>>
        #pointer: u16
        #subPointer: Uint8Array
        #cached: bool
        +encodePointer() Uint8Array
        +ensureValue() void
    }

    class StoredU256 {
        -_value: u256
        +value: u256 getter/setter
        +decode(data: Uint8Array) u256
        +encode(value: u256) Uint8Array
    }

    class StoredU128 {
        -_value: u128
        +value: u128 getter/setter
        +decode(data: Uint8Array) u128
        +encode(value: u128) Uint8Array
    }

    class StoredU64 {
        -_value: u64
        +value: u64 getter/setter
        +decode(data: Uint8Array) u64
        +encode(value: u64) Uint8Array
    }

    class StoredBoolean {
        -_value: bool
        +value: bool getter/setter
        +decode(data: Uint8Array) bool
        +encode(value: bool) Uint8Array
    }

    class StoredString {
        -_value: string
        +value: string getter/setter
        +decode(data: Uint8Array) string
        +encode(value: string) Uint8Array
    }

    class StoredAddress {
        -_value: Address
        +value: Address getter/setter
        +decode(data: Uint8Array) Address
        +encode(value: Address) Uint8Array
    }

    Stored <|-- StoredU256
    Stored <|-- StoredU128
    Stored <|-- StoredU64
    Stored <|-- StoredBoolean
    Stored <|-- StoredString
    Stored <|-- StoredAddress
```

## Available Types

| Type | Value Type | Size | Description |
|------|------------|------|-------------|
| `StoredU256` | `u256` | 32 bytes | 256-bit unsigned |
| `StoredU128` | `u128` | 16 bytes | 128-bit unsigned |
| `StoredU64` | `u64` | 8 bytes | 64-bit unsigned |
| `StoredU32` | `u32` | 4 bytes | 32-bit unsigned |
| `StoredU16` | `u16` | 2 bytes | 16-bit unsigned |
| `StoredU8` | `u8` | 1 byte | 8-bit unsigned |
| `StoredBoolean` | `bool` | 1 byte | Boolean |
| `StoredString` | `string` | Variable | UTF-8 string |
| `StoredAddress` | `Address` | 32 bytes | Address |

## Storage Key Generation

Each stored primitive computes its storage key by combining the pointer and subPointer:

```mermaid
flowchart LR
    A["pointer: u16<br/>subPointer: u256"] --> B["32-byte buffer<br/>[0-1] = pointer<br/>[2-31] = subPointer"]
    B --> C["SHA256"]
    C --> D["Storage Key<br/>(32 bytes)"]
```

## Usage

### StoredU256

```typescript
// Declaration
private balancePointer: u16 = Blockchain.nextPointer;
private _balance: StoredU256 = new StoredU256(this.balancePointer, EMPTY_POINTER);

// Read
const balance: u256 = this._balance.value;

// Write
this._balance.value = newBalance;

// Arithmetic
this._balance.value = SafeMath.add(this._balance.value, amount);
```

### StoredBoolean

```typescript
// Declaration
private pausedPointer: u16 = Blockchain.nextPointer;
private _paused: StoredBoolean = new StoredBoolean(this.pausedPointer, false);

// Read
if (this._paused.value) {
    throw new Revert('Contract is paused');
}

// Write
this._paused.value = true;
```

### StoredString

```typescript
// Declaration
private namePointer: u16 = Blockchain.nextPointer;
private _name: StoredString = new StoredString(this.namePointer, 0);

// Write (typically in onDeployment)
this._name.value = 'My Token';

// Read
const name: string = this._name.value;
```

### StoredAddress

```typescript
// Declaration
private ownerPointer: u16 = Blockchain.nextPointer;
private _owner: StoredAddress = new StoredAddress(this.ownerPointer, Address.zero());

// Write
this._owner.value = Blockchain.tx.origin;

// Read
const owner: Address = this._owner.value;

// Compare
if (!Blockchain.tx.sender.equals(this._owner.value)) {
    throw new Revert('Not owner');
}
```

## Storage Behavior

### Lazy Loading (Value Read Flow)

Values are loaded from storage on first access. The read flow follows this pattern:

```mermaid
---
config:
  theme: dark
---
flowchart LR
    A["Access .value"] --> B{"Cached?"}
    B -->|"Yes"| C["Return cached"]
    B -->|"No"| D["ensureValue()"]
    D --> E["encodePointer()"]
    E --> F["getStorageAt()"]
    F --> G["decode()"]
    G --> H["Cache & Return"]
```

```typescript
// First access triggers storage read
const balance = this._balance.value;  // Reads from storage

// Subsequent accesses use cached value
const balance2 = this._balance.value; // Uses cache (no storage read)
```

### Automatic Commit (Value Write Flow)

Changes are committed to storage automatically following this flow:

```mermaid
---
config:
  theme: dark
---
flowchart LR
    A["Set .value"] --> B["encode()"]
    B --> C["Update cache"]
    C --> D["encodePointer()"]
    D --> E["setStorageAt()"]
    E --> F["Committed"]
```

```typescript
// Write value
this._balance.value = newBalance;  // Marks as dirty

// Value is committed at transaction end
// (or immediately in some implementations)
```

### Manual Commit Control

For advanced use cases:

```typescript
// Some stored types support NoCommit for read-only access
const value = this._balance.valueNoCommit;  // Read without triggering commit

// Useful for view functions that shouldn't modify storage
```

## Initialization

### Default Values

Always provide a meaningful default:

```typescript
// Good: Zero/empty defaults
private counter: StoredU256 = new StoredU256(ptr, EMPTY_POINTER);
private name: StoredString = new StoredString(ptr, 0);
private paused: StoredBoolean = new StoredBoolean(ptr, false);
private owner: StoredAddress = new StoredAddress(ptr, Address.zero());

// The default is returned when storage slot is empty (never written)
```

### Setting Initial Values

Set values in `onDeployment`:

```typescript
public override onDeployment(calldata: Calldata): void {
    // Set initial values
    this._name.value = calldata.readString();
    this._symbol.value = calldata.readString();
    this._totalSupply.value = calldata.readU256();
    this._owner.value = Blockchain.tx.origin;
}
```

## Solidity vs OPNet Comparison

### Quick Reference Table

| Solidity | OPNet | Default Value |
|----------|-------|---------------|
| `uint256 public value;` | `StoredU256` | `u256.Zero` |
| `uint128 public value;` | `StoredU128` | `u128.Zero` |
| `uint64 public value;` | `StoredU64` | `0` |
| `uint32 public value;` | `StoredU32` | `0` |
| `uint16 public value;` | `StoredU16` | `0` |
| `uint8 public value;` | `StoredU8` | `0` |
| `string public name;` | `StoredString` | `""` |
| `bool public paused;` | `StoredBoolean` | `false` |
| `address public owner;` | `StoredAddress` | `Address.zero()` |

### Operations Comparison

| Operation | Solidity | OPNet |
|-----------|----------|-------|
| Declare state variable | `uint256 public value;` | `private _value: StoredU256 = new StoredU256(ptr, EMPTY_POINTER);` |
| Read value | `value` or `this.value` | `this._value.value` |
| Write value | `value = newValue;` | `this._value.value = newValue;` |
| Increment | `value++;` | `this._value.value = SafeMath.add(this._value.value, u256.One);` |
| Decrement | `value--;` | `this._value.value = SafeMath.sub(this._value.value, u256.One);` |
| Add amount | `value += amount;` | `this._value.value = SafeMath.add(this._value.value, amount);` |
| Check zero | `value == 0` | `this._value.value.isZero()` |
| Compare | `value > other` | `this._value.value > other` |
| Set in constructor | `value = initial;` | Use `onDeployment()` |
| Public getter | Automatic | Must define manually |

### Declaration Patterns

| Solidity Pattern | OPNet Equivalent |
|------------------|------------------|
| `uint256 public totalSupply;` | `private totalSupplyPtr: u16 = Blockchain.nextPointer;`<br>`private _totalSupply: StoredU256 = new StoredU256(this.totalSupplyPtr, EMPTY_POINTER);` |
| `string public name = "Token";` | `private namePtr: u16 = Blockchain.nextPointer;`<br>`private _name: StoredString = new StoredString(this.namePtr, 0);`<br>Then in `onDeployment`: `this._name.value = "Token";` |
| `bool public paused = false;` | `private pausedPtr: u16 = Blockchain.nextPointer;`<br>`private _paused: StoredBoolean = new StoredBoolean(this.pausedPtr, false);` |
| `address public owner;` | `private ownerPtr: u16 = Blockchain.nextPointer;`<br>`private _owner: StoredAddress = new StoredAddress(this.ownerPtr, Address.zero());` |

### Full Example Comparison

```solidity
// Solidity
contract Token {
    string public name;       // slot 0
    uint256 public supply;    // slot 1
    bool public paused;       // slot 2 (packed)

    constructor(string memory _name, uint256 _supply) {
        name = _name;
        supply = _supply;
    }
}
```

```typescript
// OPNet
@final
export class Token extends OP_NET {
    private namePointer: u16 = Blockchain.nextPointer;
    private supplyPointer: u16 = Blockchain.nextPointer;
    private pausedPointer: u16 = Blockchain.nextPointer;

    private _name: StoredString = new StoredString(this.namePointer, 0);
    private _supply: StoredU256 = new StoredU256(this.supplyPointer, EMPTY_POINTER);
    private _paused: StoredBoolean = new StoredBoolean(this.pausedPointer, false);

    public override onDeployment(calldata: Calldata): void {
        this._name.value = calldata.readString();
        this._supply.value = calldata.readU256();
    }

    // Manual getter
    public name(_calldata: Calldata): BytesWriter {
        const writer = new BytesWriter(256);
        writer.writeString(this._name.value);
        return writer;
    }
}
```

## Side-by-Side Code Examples

### Counter Contract

**Solidity:**
```solidity
contract Counter {
    uint256 public count;

    function increment() external {
        count++;
    }

    function decrement() external {
        require(count > 0, "Cannot go below zero");
        count--;
    }

    function add(uint256 amount) external {
        count += amount;
    }

    function reset() external {
        count = 0;
    }
}
```

**OPNet:**
```typescript
@final
export class Counter extends OP_NET {
    private countPointer: u16 = Blockchain.nextPointer;
    private _count: StoredU256 = new StoredU256(this.countPointer, EMPTY_POINTER);

    public increment(_calldata: Calldata): BytesWriter {
        this._count.value = SafeMath.add(this._count.value, u256.One);
        return new BytesWriter(0);
    }

    public decrement(_calldata: Calldata): BytesWriter {
        if (this._count.value.isZero()) {
            throw new Revert('Cannot go below zero');
        }
        this._count.value = SafeMath.sub(this._count.value, u256.One);
        return new BytesWriter(0);
    }

    public add(calldata: Calldata): BytesWriter {
        const amount = calldata.readU256();
        this._count.value = SafeMath.add(this._count.value, amount);
        return new BytesWriter(0);
    }

    public reset(_calldata: Calldata): BytesWriter {
        this._count.value = u256.Zero;
        return new BytesWriter(0);
    }

    public count(_calldata: Calldata): BytesWriter {
        const writer = new BytesWriter(32);
        writer.writeU256(this._count.value);
        return writer;
    }
}
```

### Ownable Contract

**Solidity:**
```solidity
contract Ownable {
    address public owner;
    bool public paused;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }

    function pause() external onlyOwner {
        paused = true;
    }

    function unpause() external onlyOwner {
        paused = false;
    }
}
```

**OPNet:**
```typescript
@final
export class Ownable extends OP_NET {
    private ownerPointer: u16 = Blockchain.nextPointer;
    private pausedPointer: u16 = Blockchain.nextPointer;

    private _owner: StoredAddress = new StoredAddress(this.ownerPointer, Address.zero());
    private _paused: StoredBoolean = new StoredBoolean(this.pausedPointer, false);

    public override onDeployment(_calldata: Calldata): void {
        this._owner.value = Blockchain.tx.origin;
    }

    private onlyOwner(): void {
        if (!Blockchain.tx.sender.equals(this._owner.value)) {
            throw new Revert('Not owner');
        }
    }

    public transferOwnership(calldata: Calldata): BytesWriter {
        this.onlyOwner();
        const newOwner = calldata.readAddress();
        if (newOwner.equals(Address.zero())) {
            throw new Revert('Invalid address');
        }
        this._owner.value = newOwner;
        return new BytesWriter(0);
    }

    public pause(_calldata: Calldata): BytesWriter {
        this.onlyOwner();
        this._paused.value = true;
        return new BytesWriter(0);
    }

    public unpause(_calldata: Calldata): BytesWriter {
        this.onlyOwner();
        this._paused.value = false;
        return new BytesWriter(0);
    }

    public owner(_calldata: Calldata): BytesWriter {
        const writer = new BytesWriter(32);
        writer.writeAddress(this._owner.value);
        return writer;
    }

    public paused(_calldata: Calldata): BytesWriter {
        const writer = new BytesWriter(1);
        writer.writeBoolean(this._paused.value);
        return writer;
    }
}
```

## Patterns

### Read-Modify-Write

```typescript
// Increment counter
public increment(_calldata: Calldata): BytesWriter {
    const current = this._counter.value;
    this._counter.value = SafeMath.add(current, u256.One);
    return new BytesWriter(0);
}

// Toggle boolean
public togglePause(_calldata: Calldata): BytesWriter {
    this.onlyDeployer(Blockchain.tx.sender);
    this._paused.value = !this._paused.value;
    return new BytesWriter(0);
}
```

### Conditional Updates

```typescript
public setOwner(calldata: Calldata): BytesWriter {
    this.onlyDeployer(Blockchain.tx.sender);

    const newOwner = calldata.readAddress();

    // Validate before writing
    if (newOwner.equals(Address.zero())) {
        throw new Revert('Invalid owner');
    }

    // Only write if different
    if (!newOwner.equals(this._owner.value)) {
        this._owner.value = newOwner;
        this.emitEvent(new OwnershipTransferred(this._owner.value, newOwner));
    }

    return new BytesWriter(0);
}
```

### View Functions

```typescript
// Return stored value
public totalSupply(_calldata: Calldata): BytesWriter {
    const writer = new BytesWriter(32);
    writer.writeU256(this._totalSupply.value);
    return writer;
}

// Return multiple values
public getInfo(_calldata: Calldata): BytesWriter {
    const writer = new BytesWriter(256);
    writer.writeString(this._name.value);
    writer.writeString(this._symbol.value);
    writer.writeU256(this._totalSupply.value);
    writer.writeU8(this._decimals.value);
    return writer;
}
```

## Best Practices

### 1. Initialize All Storage

```typescript
// Always set initial values in onDeployment
public override onDeployment(calldata: Calldata): void {
    this._name.value = 'Token';
    this._symbol.value = 'TKN';
    this._decimals.value = 18;
    this._owner.value = Blockchain.tx.origin;
}
```

### 2. Use Meaningful Defaults

```typescript
// Good: EMPTY_POINTER for uninitialized u256 values
private counter: StoredU256 = new StoredU256(ptr, EMPTY_POINTER);

// Note: Set initial values in onDeployment if needed
// this._counter.value = u256.fromU64(100);
```

### 3. Validate Before Writing

```typescript
public setLimit(calldata: Calldata): BytesWriter {
    const newLimit = calldata.readU256();

    // Validate
    if (newLimit.isZero()) {
        throw new Revert('Limit cannot be zero');
    }

    if (newLimit > u256.fromU64(1000000)) {
        throw new Revert('Limit too high');
    }

    // Then write
    this._limit.value = newLimit;
    return new BytesWriter(0);
}
```

### 4. Cache Reads in Loops

```typescript
// Bad: Multiple storage reads
for (let i = 0; i < count; i++) {
    if (amount > this._balance.value) {  // Storage read each iteration
        // ...
    }
}

// Good: Cache the value
const balance = this._balance.value;  // One storage read
for (let i = 0; i < count; i++) {
    if (amount > balance) {
        // ...
    }
}
```

---

**Navigation:**
- Previous: [BytesWriter/Reader](../types/bytes-writer-reader.md)
- Next: [Stored Arrays](./stored-arrays.md)
