# TickBitmap: Native Closest Pointer Search for OpNet Contracts

Efficient and scalable data retrieval is crucial in blockchain ecosystems. The `TickBitmap` class revolutionizes how
contracts interact with state by introducing **native closest pointer search**, enabling precise and efficient access to
the next initialized tick. This README explains the design, functionality, and real-world applications of this feature,
focusing on the power of **bitwise-optimized storage** and **pointer navigation**.

---

## Key Features

1. **Native Closest Pointer Search**:
    - Retrieve the next storage pointer with a value greater than (`>`) or less than or equal to (`<=`) a target value,
      filtered by token and position.
    - Enables high-performance, gas-efficient state transitions.

2. **Compact Pointer Design**:
    - A 256-bit pointer encodes the **base pointer**, **token address**, and **word position**, ensuring scalability and
      compatibility across diverse use cases.

3. **Efficient Bitmap Management**:
    - Leveraging bitwise operations and compact storage structures to handle massive datasets with minimal overhead.

4. **Versatile Use Cases**:
    - Ideal for applications like order books, staking systems, and time-sensitive triggers, where efficient state
      transitions are critical.

---

## Bit Allocation: Design and Purpose

The 256-bit pointer design allocates bits to different components to ensure scalability, uniqueness, and efficiency:

| **Bit Range**     | **Purpose**             | **Details**                                             |
|-------------------|-------------------------|---------------------------------------------------------|
| 240–255 (16 bits) | Base pointer identifier | Unique identifier for the bitmap's global storage root. |
| 80–239 (160 bits) | Token address           | Encodes the 160-bit address of the token.               |
| 0–79 (80 bits)    | Word position in bitmap | Represents the specific position in the bitmap.         |

### **Why This Allocation?**

- **240 Bits for Base Pointer**:
    - Ensures global uniqueness and avoids storage pointer collisions.
- **160 Bits for Token Address**:
    - Compatible with blockchain standards (e.g., Ethereum’s 160-bit addresses).
- **80 Bits for Word Position**:
    - Supports massive datasets, allowing up to \(2^{80}\) positions within a bitmap.

---

## Code Breakdown

### **Storage Pointer Calculation**

The storage pointer combines the base pointer, token address, and word position to create a globally unique identifier
for each tick:

```typescript
function getStoragePointer(token: Address, pointer: u64): u256 {
    const basePointerU256 = SafeMath.shl(u256.fromU32(this.bitmapBasePointer), 240);
    const tokenU256 = SafeMath.shl(u256.fromBytes(token), 80);
    const wordPosU256 = u256.fromU64(pointer);
    return SafeMath.or(SafeMath.or(basePointerU256, tokenU256), wordPosU256);
}
```

### **Closest Pointer Search**

Efficiently retrieve the next initialized tick based on the given conditions:

```typescript
function nextInitializedTick(tickIndex: u64, valueAtLeast: u256, lte: boolean): Potential<Tick> {
    const storagePointer = TickBitmap.getStoragePointer(this.token, tickIndex);
    const nextStoragePointer = Blockchain.getNextPointerGreaterThan(
        storagePointer,
        valueAtLeast,
        lte,
    );

    if (nextStoragePointer.isZero()) return null;

    const value = SafeMath.and(nextStoragePointer, u256.fromU64(0xffffffffffffffff));
    const tickId = this.generateTickId(this.token, value);

    return new Tick(tickId, value, nextStoragePointer);
}
```

---

## How It Works in OpNet Nodes

The native node logic separates and processes the 256-bit pointer into its components for efficient filtering and
sorting:

1. **Token and Word Position Extraction**:
    - The token is extracted from bits **80 to 239**, and the word position from bits **0 to 79**.

2. **Filtered Search**:
    - Filters pointers by token and orders them by the word position to find the closest match.

```typescript
function getBestNextPointerValueGreaterThan(
    pointer: bigint,
    lte: boolean,
    valueAtLeast: bigint,
): bigint {
    const tokenMask = ((1n << 160n) - 1n) << 80n;
    const wordPosMask = (1n << 80n) - 1n;

    const pointerToken = (pointer & tokenMask) >> 80n;
    const pointerWordPos = pointer & wordPosMask;

    const keys = Array.from(this.states.keys()).filter(
        (key) => (key & tokenMask) >> 80n === pointerToken,
    );

    keys.sort((a, b) =>
        lte
            ? this.sortBigint(b & wordPosMask, a & wordPosMask)
            : this.sortBigint(a & wordPosMask, b & wordPosMask),
    );

    for (const key of keys) {
        const keyWordPos = key & wordPosMask;
        if ((lte && keyWordPos > pointerWordPos) || (!lte && keyWordPos <= pointerWordPos)) {
            continue;
        }

        const value = this.states.get(key);
        if (value !== undefined && value > valueAtLeast) return key;
    }

    return 0n;
}
```

---

## Example: Pointer Composition

### Inputs:

- **Base Pointer**: `0x1`
- **Token Address**: `0x1234567890abcdef1234567890abcdef12345678`
- **Word Position**: `0x5`

### Computation:

1. **Base Pointer**: `0x1 << 240`
2. **Token Address**: `0x1234567890abcdef1234567890abcdef12345678 << 80`
3. **Word Position**: `0x5`

### Result:

```plaintext
Final Pointer: 0x1234567890abcdef1234567890abcdef123456781000000000000005
```

---

## Real-World Applications

1. **Decentralized Order Books**:
    - Efficiently navigate through price levels for matching orders.

2. **Staking Systems**:
    - Quickly identify the next eligible position for staking or reward calculation.

3. **Time-Locked Contracts**:
    - Discover the next trigger for time-based events in real time.

---

## Benefits of Native Closest Pointer Search

1. **Gas Efficiency**:
    - Fewer operations reduce execution costs.

2. **Scalability**:
    - Handles massive datasets with a compact and extensible design.

3. **Future-Proof Design**:
    - 80-bit word positions and 160-bit token addresses support extensive scalability.

4. **Context-Specific Precision**:
    - Tying pointers to token addresses ensures state separation and avoids conflicts.
