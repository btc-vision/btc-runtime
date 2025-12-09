# Storage API Reference

Storage classes provide persistent state management for OPNet smart contracts.

## Import

```typescript
import {
    StoredU256,
    StoredU64,
    StoredU32,
    StoredBoolean,
    StoredString,
    StoredAddress,
    StoredU256Array,
    StoredAddressArray,
    AddressMemoryMap,
    StoredMapU256,
    Blockchain,
    EMPTY_POINTER,
} from '@btc-vision/btc-runtime/runtime';
```

> **Important:** Do NOT use AssemblyScript's built-in Map for blockchain storage. See [CRITICAL: Map Implementation Warning](../storage/stored-maps.md#critical-map-implementation-warning) for details.

## Storage Type Hierarchy

The following diagram shows the complete hierarchy of storage types available in the runtime:

```mermaid
graph LR
    A[Storage Types]

    subgraph "Primitive Types"
        B1[StoredU256<br/>StoredU64<br/>StoredU32]
        B2[StoredBoolean<br/>StoredString<br/>StoredAddress]
    end

    subgraph "Array Types"
        C1[StoredU256Array<br/>StoredU64Array]
        C2[StoredU32Array<br/>StoredAddressArray]
        C3[StoredBooleanArray]
    end

    subgraph "Map Types"
        D1[AddressMemoryMap<br/>Address -> u256]
        D2[StoredMapU256<br/>u256 -> u256]
        D3[MapOfMap<br/>Nested maps]
    end

    subgraph "Backend Storage"
        E1[encodePointer<br/>Generate hash]
        E2[getStorageAt<br/>Read value]
        E3[setStorageAt<br/>Write value]
    end

    A --> B1 & B2
    A --> C1 & C2 & C3
    A --> D1 & D2 & D3

    B1 & B2 --> E1
    C1 & C2 & C3 --> E1
    D1 & D2 & D3 --> E1

    E1 --> E2 & E3
```

```mermaid
classDiagram
    class StoredU256 {
        -pointer: u16
        -subPointer: Uint8Array
        +get value() u256
        +set value(v: u256)
    }

    class StoredString {
        -pointer: u16
        -index: u64
        +get value() string
        +set value(v: string)
    }

    class AddressMemoryMap {
        -pointer: u16
        +get(key: Address) u256
        +set(key: Address, value: u256)
        +has(key: Address) bool
        +delete(key: Address) bool
    }

    class StoredU256Array {
        -pointer: u16
        +getLength() u32
        +push(value: u256) u32
        +shift() u256
        +get(index: u32) u256
        +set(index: u32, value: u256)
        +save()
    }

    class MapOfMap {
        -pointer: u16
        +get(key: Address) Nested~u256~
        +set(key: Address, value: Nested~u256~)
        +has(key: Address) bool
        +delete(key: Address) bool
    }

    class Blockchain {
        +getStorageAt(hash: Uint8Array) Uint8Array
        +setStorageAt(hash: Uint8Array, value: Uint8Array)
        +encodePointer(pointer: u16, subPointer: Uint8Array) Uint8Array
    }

    StoredU256 ..> Blockchain
    StoredString ..> Blockchain
    AddressMemoryMap ..> Blockchain
    StoredU256Array ..> Blockchain
    MapOfMap ..> Blockchain

    note for Blockchain "All storage types use\nBlockchain as backend"
```

## Primitive Storage

### StoredU256

Stores a 256-bit unsigned integer.

```typescript
class StoredU256 {
    constructor(pointer: u16, subPointer: Uint8Array)
    public get value(): u256
    public set value(v: u256)
    public get toBytes(): Uint8Array
    public toString(): string
    public set(value: u256): this
    public add(value: u256): this       // operator +
    public sub(value: u256): this       // operator -
    public mul(value: u256): this       // operator *
    public addNoCommit(value: u256): this
    public subNoCommit(value: u256): this
    public commit(): this
    public toUint8Array(): Uint8Array
}
```

```typescript
private balancePointer: u16 = Blockchain.nextPointer;
private _balance: StoredU256 = new StoredU256(this.balancePointer, EMPTY_POINTER);

// Usage
this._balance.value = u256.fromU64(1000);
const balance = this._balance.value;
```

The following sequence diagram shows how storage read and write operations work:

```mermaid
sequenceDiagram
    participant Contract
    participant Storage as Storage Object
    participant Encode as encodePointer
    participant BC as Blockchain

    Note over Contract,BC: Write Operation

    Contract->>Contract: private balance: StoredU256
    Contract->>Contract: balance.value = u256.fromU64(1000)

    Storage->>Encode: encodePointer(pointer, subPointer)
    Encode->>Encode: SHA-256(pointer + subPointer)
    Encode->>Storage: Return 32-byte hash

    Storage->>Storage: value.toUint8Array(true)
    Storage->>BC: setStorageAt(hash, bytes)
    BC->>BC: Write to persistent storage

    Note over Contract,BC: Read Operation

    Contract->>Contract: const amount = balance.value

    Storage->>Encode: encodePointer(pointer, subPointer)
    Encode->>Storage: Return 32-byte hash

    Storage->>BC: getStorageAt(hash)
    BC->>Storage: Return 32-byte value
    Storage->>Storage: u256.fromUint8ArrayBE(bytes)
    Storage->>Contract: Return u256 value
```

### StoredU64

Stores up to four 64-bit unsigned integers within a single u256 storage slot.

```typescript
class StoredU64 {
    constructor(pointer: u16, subPointer: Uint8Array)
    public get(index: u8): u64        // index 0-3
    public set(index: u8, value: u64): void
    public save(): void
    public getAll(): u64[]
    public setMultiple(values: u64[]): void
    public reset(): void
    public toString(): string
}
```

```typescript
private timestampPointer: u16 = Blockchain.nextPointer;
private _timestamps: StoredU64 = new StoredU64(this.timestampPointer, EMPTY_POINTER);

// Usage - stores up to 4 u64 values in one storage slot
this._timestamps.set(0, Blockchain.block.medianTime);  // First u64
this._timestamps.set(1, someOtherTimestamp);           // Second u64
this._timestamps.save();                                // Commit to storage

const firstTimestamp = this._timestamps.get(0);
```

### StoredU32

Stores up to eight 32-bit unsigned integers within a single u256 storage slot.

```typescript
class StoredU32 {
    constructor(pointer: u16, subPointer: Uint8Array)
    public get(index: u8): u32        // index 0-7
    public set(index: u8, value: u32): void
    public save(): void
    public getAll(): u32[]
    public setMultiple(values: u32[]): void
    public reset(): void
    public toString(): string
}
```

```typescript
private configPointer: u16 = Blockchain.nextPointer;
private _config: StoredU32 = new StoredU32(this.configPointer, EMPTY_POINTER);

// Usage - stores up to 8 u32 values in one storage slot
this._config.set(0, 100);  // First u32
this._config.set(1, 200);  // Second u32
this._config.save();       // Commit to storage

const firstValue = this._config.get(0);
```

### StoredBoolean

Stores a boolean value.

```typescript
class StoredBoolean {
    constructor(pointer: u16, defaultValue: bool)
    public get value(): bool
    public set value(v: bool)
    public toUint8Array(): Uint8Array
}
```

```typescript
private pausedPointer: u16 = Blockchain.nextPointer;
private _paused: StoredBoolean = new StoredBoolean(this.pausedPointer, false);

// Usage
this._paused.value = true;
if (this._paused.value) {
    throw new Revert('Contract is paused');
}
```

### StoredString

Stores a string value.

```typescript
class StoredString {
    constructor(pointer: u16, index: u64 = 0)
    public get value(): string
    public set value(v: string)
}
```

```typescript
private namePointer: u16 = Blockchain.nextPointer;
private _name: StoredString = new StoredString(this.namePointer, 0);

// Usage
this._name.value = 'My Token';
const name = this._name.value;
```

### StoredAddress

Stores an Address value. Default value is Address.zero().

```typescript
class StoredAddress {
    constructor(pointer: u16)
    public get value(): Address
    public set value(v: Address)
    public isDead(): bool  // Note: checks if address equals Address.zero(), not ExtendedAddress.dead()
}
```

```typescript
private ownerPointer: u16 = Blockchain.nextPointer;
private _owner: StoredAddress = new StoredAddress(this.ownerPointer);

// Usage
this._owner.value = Blockchain.tx.origin;
const owner = this._owner.value;
```

## Array Storage

### StoredU256Array

Dynamic array of u256 values. Elements are packed into 32-byte storage slots.

```typescript
class StoredU256Array {
    constructor(pointer: u16, subPointer: Uint8Array, maxLength: u32 = DEFAULT_MAX_LENGTH)
    public getLength(): u32
    public push(value: u256, isPhysical?: bool): u32
    public deleteLast(): void
    public delete(index: u32): void
    public shift(): u256
    public get(index: u32): u256
    public set(index: u32, value: u256): void
    public getAll(startIndex: u32, count: u32): u256[]
    public setMultiple(startIndex: u32, values: u256[]): void
    public save(): void
    public reset(): void
    public deleteAll(): void
    public startingIndex(): u32
    public setStartingIndex(index: u32): void
}
```

```typescript
private tokenIdsPointer: u16 = Blockchain.nextPointer;
private tokenIds: StoredU256Array = new StoredU256Array(this.tokenIdsPointer, EMPTY_POINTER);

// Usage
this.tokenIds.push(u256.fromU64(1));
this.tokenIds.push(u256.fromU64(2));
this.tokenIds.save();                  // Commit changes to storage

const first = this.tokenIds.get(0);    // u256.fromU64(1)
const len = this.tokenIds.getLength(); // 2
```

The following diagram shows the array operation flow:

```mermaid
flowchart LR
    A[StoredU256Array] --> B{Operation<br/>Type}

    subgraph "push Operation"
        B -->|push| C[Get current length]
        C --> D[Encode pointer<br/>with index]
        D --> E[Write value at index]
        E --> F[Increment length]
    end

    subgraph "get Operation"
        B -->|get| G[Validate<br/>index < length]
        G --> H[Encode pointer<br/>with index]
        H --> I[Read value<br/>from storage]
        I --> J[Return u256]
    end

    subgraph "shift Operation"
        B -->|shift| K[Validate<br/>length > 0]
        K --> L[Read first element]
        L --> M[Decrement length]
        M --> N[Return value]
    end

    subgraph "set Operation"
        B -->|set| O[Validate<br/>index < length]
        O --> P[Encode pointer<br/>with index]
        P --> Q[Write new value]
    end
```

### StoredAddressArray

Dynamic array of Address values. Each address takes one 32-byte storage slot.

```typescript
class StoredAddressArray {
    constructor(pointer: u16, subPointer: Uint8Array, maxLength: u32 = DEFAULT_MAX_LENGTH)
    public getLength(): u32
    public push(value: Address, isPhysical?: bool): u32
    public deleteLast(): void
    public delete(index: u32): void
    public shift(): Address
    public get(index: u32): Address
    public set(index: u32, value: Address): void
    public getAll(startIndex: u32, count: u32): Address[]
    public setMultiple(startIndex: u32, values: Address[]): void
    public save(): void
    public reset(): void
    public deleteAll(): void
    public startingIndex(): u32
    public setStartingIndex(index: u32): void
}
```

```typescript
private oraclesPointer: u16 = Blockchain.nextPointer;
private oracles: StoredAddressArray = new StoredAddressArray(this.oraclesPointer, EMPTY_POINTER);

// Add oracle
this.oracles.push(oracleAddress);
this.oracles.save();  // Commit changes

// Iterate
for (let i: u32 = 0; i < this.oracles.getLength(); i++) {
    const oracle = this.oracles.get(i);
    // Process oracle
}
```

### Other Array Types

All array types share the same base API as `StoredU256Array` (extending `StoredPackedArray<T>`) with their respective element types:

- `StoredU128Array` - 2 u128 values per 32-byte slot
- `StoredU64Array` - 4 u64 values per 32-byte slot
- `StoredU32Array` - 8 u32 values per 32-byte slot
- `StoredU16Array` - 16 u16 values per 32-byte slot
- `StoredU8Array` - 32 u8 values per 32-byte slot
- `StoredBooleanArray` - 256 boolean values per 32-byte slot (bit-packed)

> **Note:** These are array types only. There are no standalone `StoredU128`, `StoredU16`, or `StoredU8` primitive classes. For storing single small values, use `StoredU64` (which packs 4 u64 values) or `StoredU32` (which packs 8 u32 values) in a single storage slot.

## Map Storage

### AddressMemoryMap

Maps addresses to u256 values. Always returns u256.Zero for unset addresses.

```typescript
class AddressMemoryMap {
    constructor(pointer: u16)
    public get(key: Address): u256
    public set(key: Address, value: u256): this
    public getAsUint8Array(key: Address): Uint8Array
    public setAsUint8Array(key: Address, value: Uint8Array): this
    public has(key: Address): bool
    public delete(key: Address): bool
}
```

The following diagram shows how map keys are converted to storage hashes:

```mermaid
flowchart LR
    subgraph "Key to Hash"
        A[AddressMemoryMap] --> B[Address Key]
        B --> C[encodePointer<br/>pointer, address.toBytes]
        C --> D[32-byte storage hash]
    end

    subgraph "Operations"
        D --> E{get or set?}
        E -->|get| F[Blockchain.getStorageAt<br/>hash]
        F --> G[Convert to u256]
        G --> H[Return value<br/>or u256.Zero]
        E -->|set| I[value.toUint8Array]
        I --> J[Blockchain.setStorageAt<br/>hash, bytes]
    end
```

#### Usage Example

```typescript
// mapping(address => uint256)
private balancesPointer: u16 = Blockchain.nextPointer;
private balances: AddressMemoryMap;

constructor() {
    super();
    this.balances = new AddressMemoryMap(this.balancesPointer);
}

// Usage
const balance = this.balances.get(userAddress);  // Returns u256
this.balances.set(userAddress, u256.fromU64(1000));
```

The following sequence diagram shows the complete balance mapping flow:

```mermaid
sequenceDiagram
    participant Contract
    participant Map as AddressMemoryMap
    participant BC as Blockchain

    Note over Contract,BC: Balance Mapping Example

    Contract->>Contract: balances = new AddressMemoryMap(pointer)

    Note over Contract,BC: Set Balance

    Contract->>Map: balances.set(userAddress, u256.fromU64(1000))
    Map->>Map: hash = encodePointer(pointer, userAddress.toBytes())
    Map->>BC: setStorageAt(hash, 1000.toUint8Array())
    BC->>Map: Storage updated

    Note over Contract,BC: Get Balance

    Contract->>Map: balances.get(userAddress)
    Map->>Map: hash = encodePointer(pointer, userAddress.toBytes())
    Map->>BC: getStorageAt(hash)
    BC->>Map: Return bytes
    Map->>Map: u256.fromUint8ArrayBE(bytes)
    Map->>Contract: Return u256.fromU64(1000)

    Note over Contract,BC: Get Non-Existent Balance

    Contract->>Map: balances.get(unknownAddress)
    Map->>BC: getStorageAt(hash)
    BC->>Map: Return zeros
    Map->>Contract: Return u256.Zero
```

### StoredMapU256

Maps u256 keys to u256 values.

```typescript
class StoredMapU256 {
    constructor(pointer: u16, subPointer: Uint8Array = new Uint8Array(30))
    public get(key: u256): u256
    public set(key: u256, value: u256): void
    public delete(key: u256): void  // Sets value to zero
}
```

Note: `StoredMapU256` does not have a `has()` method. To check if a key exists, compare the returned value with `u256.Zero`.

```typescript
private dataPointer: u16 = Blockchain.nextPointer;
private data: StoredMapU256 = new StoredMapU256(this.dataPointer);

// Usage
const key = u256.fromU64(123);
this.data.set(key, u256.fromU64(456));
const value = this.data.get(key);
```

### Nested Maps (MapOfMap)

For allowances pattern (owner => spender => amount):

```typescript
class MapOfMap<T> {
    constructor(pointer: u16)
    public get(key: Address): Nested<T>
    public set(key: Address, value: Nested<T>): this
    public has(key: Address): bool
    public delete(key: Address): bool
    public clear(): void
}

class Nested<T> {
    constructor(parent: Uint8Array, pointer: u16)
    public get(key: Uint8Array): T
    public set(key: Uint8Array, value: T): this
    public has(key: Uint8Array): bool
}
```

> **Important:** `MapOfMap.get(key)` returns a `Nested<T>` object, not the final value. You must call `.get()` on the nested object to retrieve the actual value.

See [Stored Maps - MapOfMap](../storage/stored-maps.md#mapofmap) for detailed usage patterns and diagrams.

## Storage Patterns

### Lazy Initialization

```typescript
private _data: StoredU256 | null = null;
private dataPointer: u16 = Blockchain.nextPointer;

private get data(): StoredU256 {
    if (!this._data) {
        this._data = new StoredU256(this.dataPointer, EMPTY_POINTER);
    }
    return this._data;
}
```

### Computed Storage Keys

```typescript
import { encodePointer } from '@btc-vision/btc-runtime/runtime';

private storagePointer: u16 = Blockchain.nextPointer;

private getKey(addr: Address, slot: u256): u256 {
    const combined = new Uint8Array(64);
    combined.set(addr.toBytes(), 0);
    combined.set(slot.toUint8Array(), 32);
    return u256.fromBytes(Blockchain.sha256(combined));
}

public getValue(addr: Address, slot: u256): u256 {
    const key = this.getKey(addr, slot);
    const pointerHash = encodePointer(this.storagePointer, key.toUint8Array(true));
    const stored = Blockchain.getStorageAt(pointerHash);
    return u256.fromUint8ArrayBE(stored);
}
```

### Counter Pattern

```typescript
private counterPointer: u16 = Blockchain.nextPointer;
private _counter: StoredU256 = new StoredU256(this.counterPointer, EMPTY_POINTER);

public getNextId(): u256 {
    const current = this._counter.value;
    this._counter.value = SafeMath.add(current, u256.One);
    return current;
}
```

## Low-Level Storage

Direct storage access via Blockchain:

```typescript
import { encodePointer } from '@btc-vision/btc-runtime/runtime';

// Generate storage key hash
public encodePointer(pointer: u16, subPointer: Uint8Array): Uint8Array

// Write to storage
public setStorageAt(pointerHash: Uint8Array, value: Uint8Array): void

// Read from storage
public getStorageAt(pointerHash: Uint8Array): Uint8Array

// Check existence
public hasStorageAt(pointerHash: Uint8Array): bool
```

```typescript
// Direct storage example
const pointer: u16 = Blockchain.nextPointer;
const subPointer = u256.fromU64(1).toUint8Array(true);

// Create storage key
const pointerHash = encodePointer(pointer, subPointer);

// Write value
Blockchain.setStorageAt(pointerHash, u256.fromU64(100).toUint8Array(true));

// Read value
const stored = Blockchain.getStorageAt(pointerHash);
const value = u256.fromUint8ArrayBE(stored);
```

## Best Practices

### 1. Declare Pointers First

```typescript
class MyContract extends OP_NET {
    // Declare all pointers before any stored values
    private ptr1: u16 = Blockchain.nextPointer;
    private ptr2: u16 = Blockchain.nextPointer;
    private ptr3: u16 = Blockchain.nextPointer;

    // Then declare stored values
    private _value1: StoredU256;
    private _value2: StoredBoolean;

    public constructor() {
        super();
        this._value1 = new StoredU256(this.ptr1, EMPTY_POINTER);
        this._value2 = new StoredBoolean(this.ptr2, false);
    }
}
```

### 2. Use Appropriate Types

```typescript
// Good - use smallest type that fits
private _count: StoredU32;  // If count < 4 billion

// Less efficient
private _count: StoredU256;  // Uses more storage
```

### 3. Batch Updates

```typescript
// Multiple related updates in one call
public updateBoth(a: u256, b: u256): void {
    this._valueA.value = a;
    this._valueB.value = b;
}
```

## Solidity Comparison

| Solidity | OPNet Storage |
|----------|---------------|
| `uint256 public value` | `StoredU256` |
| `mapping(address => uint256)` | `AddressMemoryMap` |
| `mapping(address => mapping(address => uint256))` | `MapOfMap<u256>` |
| `uint256[] public array` | `StoredU256Array` |
| `bool public paused` | `StoredBoolean` |
| `string public name` | `StoredString` |
| `address public owner` | `StoredAddress` |

---

**Navigation:**
- Previous: [SafeMath API](./safe-math.md)
- Next: [Events API](./events.md)
