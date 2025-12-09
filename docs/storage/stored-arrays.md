# Stored Arrays

Stored arrays persist ordered collections of values on-chain. They support push, pop, get, set, and length operations with automatic bounds checking.

## Overview

```typescript
import {
    StoredU256Array,
    StoredU128Array,
    StoredU64Array,
    StoredAddressArray,
    StoredBooleanArray,
    Blockchain,
} from '@btc-vision/btc-runtime/runtime';
import { u256 } from '@btc-vision/as-bignum/assembly';

// Allocate storage pointer
private holdersPointer: u16 = Blockchain.nextPointer;

// Create stored array with subPointer
private holders: StoredAddressArray;

constructor() {
    super();
    this.holders = new StoredAddressArray(this.holdersPointer, EMPTY_POINTER);
}

// Operations
this.holders.push(newAddress);
const first = this.holders.get(0);
const length = this.holders.getLength();
this.holders.deleteLast();  // removes last element
this.holders.save();        // commit changes to storage
```

## Available Types

| Type | Element Type | Description |
|------|-------------|-------------|
| `StoredU256Array` | `u256` | Array of 256-bit unsigned |
| `StoredU128Array` | `u128` | Array of 128-bit unsigned |
| `StoredU64Array` | `u64` | Array of 64-bit unsigned |
| `StoredU32Array` | `u32` | Array of 32-bit unsigned |
| `StoredU16Array` | `u16` | Array of 16-bit unsigned |
| `StoredU8Array` | `u8` | Array of bytes |
| `StoredAddressArray` | `Address` | Array of addresses |
| `StoredBooleanArray` | `bool` | Array of booleans |

## Storage Structure

Arrays use multiple storage slots with sequential subPointers for each element:

```mermaid
flowchart LR
    subgraph instance["StoredArray Instance"]
        A["pointer: u16<br/>e.g., 0x0005"]
    end

    subgraph layout["Storage Layout"]
        B["Length Slot<br/>pointer base"]
        C["Element 0<br/>subPointer = 0"]
        D["Element 1<br/>subPointer = 1"]
        E["Element 2<br/>subPointer = 2"]
        F["Element 3<br/>subPointer = 3"]
        G["..."]
    end

    subgraph keys["Storage Keys (SHA256)"]
        H["pointer + 0<br/>-> length: u64"]
        I["pointer + 1<br/>-> element 0"]
        J["pointer + 2<br/>-> element 1"]
        K["pointer + 3<br/>-> element 2"]
    end

    A --> B
    B --> H
    C --> I
    D --> J
    E --> K

    H --> L[("Blockchain Storage")]
    I --> L
    J --> L
    K --> L
```

### Size Limits

Maximum array length: **4,294,967,294 elements** (u32.MAX_VALUE - 1), though practical limits depend on gas costs.

```typescript
// Check before adding
if (this.holders.getLength() >= MAX_ALLOWED) {
    throw new Revert('Array full');
}
this.holders.push(newHolder);
this.holders.save();  // Don't forget to save!
```

## Operations

### Push

Add element to end. The push operation follows this flow:

```mermaid
---
config:
  theme: dark
---
flowchart LR
    A["array.push(value)"] --> B["Read length"]
    B --> C{"length < 65535?"}
    C -->|"No"| D["Throw error"]
    C -->|"Yes"| E["Calculate key"]
    E --> F["setStorageAt()"]
    F --> G["Increment length"]
    G --> H["Save length"]
```

```typescript
// Add new element
this.holders.push(newHolder);
this.holders.save();  // Commit changes

// Length increases by 1
const newLength = this.holders.getLength();
```

### deleteLast / shift

Remove elements from the array. `deleteLast()` removes from the end, `shift()` removes from the beginning.

```mermaid
---
config:
  theme: dark
---
flowchart LR
    A["array.deleteLast()"] --> B["Read length"]
    B --> C{"length > 0?"}
    C -->|"No"| D["Throw error"]
    C -->|"Yes"| E["Zero last element"]
    E --> F["Decrement length"]
    F --> G["Mark as changed"]
```

```typescript
// Remove last element
this.holders.deleteLast();
this.holders.save();  // Commit changes

// Remove first element and return it
const removed: Address = this.holders.shift();
this.holders.save();  // Commit changes

// Reverts if array is empty
```

### Get

Read element at index:

```typescript
// Get element at index
const holder: Address = this.holders.get(index);

// Reverts if index >= length
```

### Set

Write element at index:

```typescript
// Set element at index
this.holders.set(index, newValue);
this.holders.save();  // Commit changes

// Reverts if index >= MAX_LENGTH
// Can set beyond current length (use push for proper length tracking)
```

### Length

Get current array length:

```typescript
// Get length
const count: u32 = this.holders.getLength();

// Check if empty
if (this.holders.getLength() === 0) {
    throw new Revert('No holders');
}
```

## Solidity vs OPNet Comparison

### Quick Reference Table

| Solidity Array Type | OPNet Equivalent | Elements per Slot | Default Max |
|---------------------|------------------|-------------------|-------------|
| `uint256[]` | `StoredU256Array` | 1 | u32.MAX_VALUE - 1 |
| `uint128[]` | `StoredU128Array` | 2 | u32.MAX_VALUE - 1 |
| `uint64[]` | `StoredU64Array` | 4 | u32.MAX_VALUE - 1 |
| `uint32[]` | `StoredU32Array` | 8 | u32.MAX_VALUE - 1 |
| `uint16[]` | `StoredU16Array` | 16 | u32.MAX_VALUE - 1 |
| `uint8[]` / `bytes` | `StoredU8Array` | 32 | u32.MAX_VALUE - 1 |
| `address[]` | `StoredAddressArray` | 1 | u32.MAX_VALUE - 1 |
| `bool[]` | `StoredBooleanArray` | 256 (bit-packed) | u32.MAX_VALUE - 1 |

### Operations Comparison

| Operation | Solidity | OPNet |
|-----------|----------|-------|
| Declare array | `address[] public holders;` | `private holders: StoredAddressArray;` |
| Initialize | Automatic | `this.holders = new StoredAddressArray(this.holdersPointer, EMPTY_POINTER);` |
| Push element | `holders.push(addr);` | `holders.push(addr); holders.save();` |
| Pop element | `holders.pop();` | `holders.deleteLast(); holders.save();` |
| Shift element | N/A | `holders.shift(); holders.save();` |
| Get element | `holders[i]` | `holders.get(i)` |
| Set element | `holders[i] = addr;` | `holders.set(i, addr); holders.save();` |
| Get length | `holders.length` | `holders.getLength()` |
| Delete at index | `delete holders[i];` | `holders.delete(i); holders.save();` |
| Check bounds | Runtime revert | Runtime revert |
| Clear array | `delete holders;` | `holders.deleteAll();` |
| Reset array | N/A | `holders.reset();` |

### Common Patterns

| Pattern | Solidity | OPNet |
|---------|----------|-------|
| Loop through array | `for (uint i = 0; i < arr.length; i++)` | `for (let i: u32 = 0; i < arr.getLength(); i++)` |
| Remove at index (swap) | `arr[i] = arr[arr.length-1]; arr.pop();` | `arr.set(i, arr.get(arr.getLength()-1)); arr.deleteLast(); arr.save();` |
| Check if empty | `arr.length == 0` | `arr.getLength() === 0` |
| Get last element | `arr[arr.length - 1]` | `arr.get(arr.getLength() - 1)` |
| Initialize with values | `arr = [1, 2, 3];` | Multiple `arr.push()` calls in `onDeployment`, then `arr.save()` |

For complete contract examples using stored arrays, see the [Examples](../examples/) section.

## Side-by-Side Code Examples

### Simple Address List

**Solidity:**
```solidity
contract AddressList {
    address[] public addresses;

    function add(address addr) external {
        addresses.push(addr);
    }

    function remove(uint256 index) external {
        require(index < addresses.length, "Out of bounds");
        addresses[index] = addresses[addresses.length - 1];
        addresses.pop();
    }

    function get(uint256 index) external view returns (address) {
        return addresses[index];
    }

    function count() external view returns (uint256) {
        return addresses.length;
    }

    function contains(address addr) external view returns (bool) {
        for (uint i = 0; i < addresses.length; i++) {
            if (addresses[i] == addr) return true;
        }
        return false;
    }
}
```

**OPNet:**
```typescript
@final
export class AddressList extends OP_NET {
    private addressesPointer: u16 = Blockchain.nextPointer;
    private addresses: StoredAddressArray;

    constructor() {
        super();
        this.addresses = new StoredAddressArray(this.addressesPointer, EMPTY_POINTER);
    }

    public add(calldata: Calldata): BytesWriter {
        const addr = calldata.readAddress();
        this.addresses.push(addr);
        this.addresses.save();
        return new BytesWriter(0);
    }

    public remove(calldata: Calldata): BytesWriter {
        const index = calldata.readU32();
        const length = this.addresses.getLength();
        if (index >= length) {
            throw new Revert('Out of bounds');
        }
        if (index < length - 1) {
            this.addresses.set(index, this.addresses.get(length - 1));
        }
        this.addresses.deleteLast();
        this.addresses.save();
        return new BytesWriter(0);
    }

    public get(calldata: Calldata): BytesWriter {
        const index = calldata.readU32();
        const writer = new BytesWriter(32);
        writer.writeAddress(this.addresses.get(index));
        return writer;
    }

    public count(_calldata: Calldata): BytesWriter {
        const writer = new BytesWriter(4);
        writer.writeU32(this.addresses.getLength());
        return writer;
    }

    public contains(calldata: Calldata): BytesWriter {
        const addr = calldata.readAddress();
        let found = false;
        const length = this.addresses.getLength();
        for (let i: u32 = 0; i < length; i++) {
            if (this.addresses.get(i).equals(addr)) {
                found = true;
                break;
            }
        }
        const writer = new BytesWriter(1);
        writer.writeBoolean(found);
        return writer;
    }
}
```

### Value Queue (FIFO-like with array)

**Solidity:**
```solidity
contract ValueQueue {
    uint256[] public values;

    function enqueue(uint256 value) external {
        values.push(value);
    }

    // Note: This is O(n) - not efficient for large queues
    function dequeue() external returns (uint256) {
        require(values.length > 0, "Empty queue");
        uint256 first = values[0];
        for (uint i = 0; i < values.length - 1; i++) {
            values[i] = values[i + 1];
        }
        values.pop();
        return first;
    }

    function peek() external view returns (uint256) {
        require(values.length > 0, "Empty queue");
        return values[0];
    }

    function size() external view returns (uint256) {
        return values.length;
    }
}
```

**OPNet:**
```typescript
@final
export class ValueQueue extends OP_NET {
    private valuesPointer: u16 = Blockchain.nextPointer;
    private values: StoredU256Array;

    constructor() {
        super();
        this.values = new StoredU256Array(this.valuesPointer, EMPTY_POINTER);
    }

    public enqueue(calldata: Calldata): BytesWriter {
        const value = calldata.readU256();
        this.values.push(value);
        this.values.save();
        return new BytesWriter(0);
    }

    // Note: Use shift() for O(1) dequeue - it uses circular buffer with startIndex
    public dequeue(_calldata: Calldata): BytesWriter {
        const length = this.values.getLength();
        if (length === 0) {
            throw new Revert('Empty queue');
        }
        const first = this.values.shift();  // O(1) operation
        this.values.save();

        const writer = new BytesWriter(32);
        writer.writeU256(first);
        return writer;
    }

    public peek(_calldata: Calldata): BytesWriter {
        if (this.values.getLength() === 0) {
            throw new Revert('Empty queue');
        }
        const writer = new BytesWriter(32);
        writer.writeU256(this.values.get(0));
        return writer;
    }

    public size(_calldata: Calldata): BytesWriter {
        const writer = new BytesWriter(4);
        writer.writeU32(this.values.getLength());
        return writer;
    }
}
```

## Common Patterns

### Iterating

```typescript
// Forward iteration
const length = this.holders.getLength();
for (let i: u32 = 0; i < length; i++) {
    const holder = this.holders.get(i);
    // Process holder...
}

// Batch retrieval for efficiency
const batchSize: u32 = 100;
const allValues = this.values.getAll(0, batchSize);
for (let i = 0; i < allValues.length; i++) {
    // Process allValues[i]...
}
```

### Finding Elements

```typescript
// Find index of element
private indexOf(array: StoredAddressArray, target: Address): i32 {
    const length = array.getLength();
    for (let i: u32 = 0; i < length; i++) {
        if (array.get(i).equals(target)) {
            return i32(i);
        }
    }
    return -1;  // Not found
}

// Check if element exists
private contains(array: StoredAddressArray, target: Address): bool {
    return this.indexOf(array, target) >= 0;
}
```

### Removing Elements

```typescript
// Remove at index (swap with last, then deleteLast)
private removeAt(array: StoredAddressArray, index: u32): void {
    const length = array.getLength();

    if (index >= length) {
        throw new Revert('Index out of bounds');
    }

    // If not last element, swap with last
    if (index < length - 1) {
        const last = array.get(length - 1);
        array.set(index, last);
    }

    // Remove last element
    array.deleteLast();
    array.save();
}

// Remove by value
private removeValue(array: StoredAddressArray, value: Address): bool {
    const idx = this.indexOf(array, value);
    if (idx < 0) {
        return false;
    }
    this.removeAt(array, u32(idx));
    return true;
}

// Alternative: Use delete(index) to remove at specific index
// This sets the element to zero but doesn't shift other elements
```

### Unique Elements Set

```typescript
// Add only if not present
private addUnique(array: StoredAddressArray, value: Address): bool {
    if (this.contains(array, value)) {
        return false;  // Already exists
    }

    array.push(value);
    array.save();
    return true;
}
```

## Use Cases

### Token Holder Tracking

```typescript
@final
export class Token extends OP20 {
    private holdersPointer: u16 = Blockchain.nextPointer;
    private holders: StoredAddressArray;

    constructor() {
        super();
        this.holders = new StoredAddressArray(this.holdersPointer, EMPTY_POINTER);
    }

    public override _transfer(from: Address, to: Address, amount: u256): void {
        // Track new holders
        if (this.balanceOf(to).isZero() && !amount.isZero()) {
            this.holders.push(to);
            this.holders.save();
        }

        super._transfer(from, to, amount);

        // Note: Removing holders when balance becomes zero
        // requires additional logic (holder index mapping)
    }

    public getHolderCount(_calldata: Calldata): BytesWriter {
        const writer = new BytesWriter(4);
        writer.writeU32(this.holders.getLength());
        return writer;
    }
}
```

### Order Queue

```typescript
@final
export class OrderBook extends OP_NET {
    private ordersPointer: u16 = Blockchain.nextPointer;
    private orders: StoredU256Array;

    constructor() {
        super();
        this.orders = new StoredU256Array(this.ordersPointer, EMPTY_POINTER);
    }

    public addOrder(calldata: Calldata): BytesWriter {
        const orderId = calldata.readU256();
        this.orders.push(orderId);
        this.orders.save();
        return new BytesWriter(0);
    }

    public processNextOrder(_calldata: Calldata): BytesWriter {
        if (this.orders.getLength() === 0) {
            throw new Revert('No orders');
        }

        // FIFO: Use shift() to get first order (O(1) with circular buffer)
        const orderId = this.orders.shift();
        this.orders.save();

        // Process order...

        const writer = new BytesWriter(32);
        writer.writeU256(orderId);
        return writer;
    }
}
```

### Whitelist Management

```typescript
@final
export class Whitelist extends OP_NET {
    private addressesPointer: u16 = Blockchain.nextPointer;
    private addresses: StoredAddressArray;

    constructor() {
        super();
        this.addresses = new StoredAddressArray(this.addressesPointer, EMPTY_POINTER);
    }

    public add(calldata: Calldata): BytesWriter {
        this.onlyDeployer(Blockchain.tx.sender);

        const addr = calldata.readAddress();

        // Check not already in list
        const length = this.addresses.getLength();
        for (let i: u32 = 0; i < length; i++) {
            if (this.addresses.get(i).equals(addr)) {
                throw new Revert('Already whitelisted');
            }
        }

        this.addresses.push(addr);
        this.addresses.save();
        return new BytesWriter(0);
    }

    public isWhitelisted(calldata: Calldata): BytesWriter {
        const addr = calldata.readAddress();

        let found = false;
        const length = this.addresses.getLength();
        for (let i: u32 = 0; i < length; i++) {
            if (this.addresses.get(i).equals(addr)) {
                found = true;
                break;
            }
        }

        const writer = new BytesWriter(1);
        writer.writeBoolean(found);
        return writer;
    }
}
```

## Best Practices

### 1. Limit Array Size

```typescript
const MAX_ARRAY_SIZE: u32 = 1000;

public addItem(calldata: Calldata): BytesWriter {
    if (this.items.getLength() >= MAX_ARRAY_SIZE) {
        throw new Revert('Array size limit reached');
    }
    this.items.push(calldata.readU256());
    this.items.save();
    return new BytesWriter(0);
}
```

### 2. Cache Length in Loops

```typescript
// Good: Cache length
const length = this.items.getLength();
for (let i: u32 = 0; i < length; i++) {
    // ...
}

// Even better: Use getAll() for batch operations
const items = this.items.getAll(0, 100);
for (let i = 0; i < items.length; i++) {
    // Process items[i]
}
```

### 3. Use Maps for Lookup-Heavy Cases

If you frequently check "is X in array?", consider using a map alongside the array:

```typescript
private itemsPointer: u16 = Blockchain.nextPointer;
private itemExistsPointer: u16 = Blockchain.nextPointer;

private items: StoredU256Array;
private itemExists: StoredMapU256;

constructor() {
    super();
    this.items = new StoredU256Array(this.itemsPointer, EMPTY_POINTER);
    this.itemExists = new StoredMapU256(this.itemExistsPointer);
}

public addItem(item: u256): void {
    if (!this.itemExists.get(item).isZero()) {
        throw new Revert('Already exists');
    }
    this.items.push(item);
    this.items.save();
    this.itemExists.set(item, u256.One);
}
```

### 4. Always Call save() After Modifications

```typescript
// Multiple modifications, single save
this.items.push(value1);
this.items.push(value2);
this.items.set(0, value3);
this.items.save();  // Commit all changes at once
```

---

**Navigation:**
- Previous: [Stored Primitives](./stored-primitives.md)
- Next: [Stored Maps](./stored-maps.md)
