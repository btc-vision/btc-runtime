# Understanding Storage Pointers and Sub-Pointers in OP_NET

## Table of Contents

- [Understanding Storage Pointers and Sub-Pointers](#1-understanding-storage-pointers-and-sub-pointers)
- [Encoding and Hashing Process](#2-encoding-and-hashing-process)
- [How Encoding and Hashing Work](#3-how-encoding-and-hashing-work)
- [Usage Example in a Contract](#4-usage-example-in-a-contract)
- [Proofs and Integrity](#5-proofs-and-integrity)
- [Summary](#summary)

### 1. **Understanding Storage Pointers and Sub-Pointers**

In OP_NET, storage is managed using a combination of primary pointers (also known as pointers) and sub-pointers.
Together, these two elements are used to define and locate specific storage slots within the contract's storage space.
The process of encoding these pointers and sub-pointers involves cryptographic hashing, which ensures that the storage
locations are secure and resistant to tampering.

### 2. **Encoding and Hashing Process**

**Primary Pointer (Pointer):**

- The primary pointer is a `u16` value that acts as the main identifier for a storage slot.

**Sub-Pointer:**

- The sub-pointer is a `u256` value that refines the storage location within the slot identified by the primary pointer.

**Encoding and Hashing:**

- Both the pointer and sub-pointer are encoded and hashed together to generate a unique `MemorySlotPointer`, which is
  then used to store or retrieve data from the contract's storage.

### 3. **How Encoding and Hashing Work**

Let's break down the encoding and hashing process:

#### **1. Encoding a Selector or Pointer**

For example, to encode a selector (like a function name) or a string into a `MemorySlotPointer`:

```typescript
export function encodeSelector(name: string): Selector {
    const typed = Uint8Array.wrap(String.UTF8.encode(name));
    const hash = Sha256.hash(typed);

    return bytes4(hash); // Returns the first 4 bytes of the hash
}

export function encodePointer(str: string): MemorySlotPointer {
    const typed = Uint8Array.wrap(String.UTF8.encode(str));
    const hash = Sha256.hash(typed);

    return bytes32(hash); // Returns the full 32-byte hash
}
```

#### **2. Combining Pointer and Sub-Pointer**

To combine a primary pointer (`u16`) and a sub-pointer (`u256`), the following method is used:

```typescript
export function encodePointerHash(pointer: u16, sub: u256): MemorySlotPointer {
    const finalBuffer: Uint8Array = new Uint8Array(34); // 2 bytes for pointer + 32 bytes for sub-pointer
    const mergedKey: u8[] = [u8(pointer & u16(0xff)), u8((pointer >> u16(8)) & u16(0xff))];

    for (let i: i32 = 0; i < mergedKey.length; i++) {
        finalBuffer[i] = mergedKey[i];
    }

    const subKey = sub.toUint8Array();
    for (let i: i32 = 0; i < subKey.length; i++) {
        finalBuffer[mergedKey.length + i] = subKey[i];
    }

    return bytes32(Sha256.hash(finalBuffer)); // Returns a 32-byte hash of the combined pointer and sub-pointer
}
```

#### **3. Visual Hex Example**

Let’s consider an example where:

- **Pointer**: `0x01`
- **Sub-Pointer**: `0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890`

The `encodePointerHash` function combines these two values and hashes them to produce a unique `MemorySlotPointer`:

```typescript
const pointer: u16 = 0x01;
const subPointer: u256 = u256.fromHexString("abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890");

const memorySlotPointer: MemorySlotPointer = encodePointerHash(pointer, subPointer);
```

- **Pointer (0x01)**: `0001` (in hexadecimal, 2 bytes)
- **Sub-Pointer**: `abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890` (in hexadecimal, 32 bytes)

**Final Buffer (before hashing):**

```
0001abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
```

This final buffer is then hashed using SHA-256 to produce a `MemorySlotPointer`:

**Hashed Result:**

```
5f8fdbfe9d6c7e9dff7c80f104b82cbf8b365b762c3a6e3c68e6a53e0f2360bf
```

This 32-byte value (`MemorySlotPointer`) is now the key used to store and retrieve the data from the contract’s storage.

### 4. **Usage Example in a Contract**

Here’s how this works in a practical contract scenario:

```typescript
import { u256 } from 'as-bignum/assembly';
import { Blockchain } from '@btc-vision/btc-runtime/runtime/env';
import { MemorySlotPointer } from '@btc-vision/btc-runtime/runtime/memory/MemorySlotPointer';

class MyStorageContract {
    private pointer: u16;
    private subPointer: MemorySlotPointer;

    constructor(pointer: u16, subKey: string) {
        this.pointer = pointer;
        this.subPointer = encodePointer(subKey); // Encode a string into a sub-pointer
    }

    public storeData(value: u256): void {
        const storageKey = encodePointerHash(this.pointer, this.subPointer);
        Blockchain.setStorageAt(storageKey, u256.Zero, value);
    }

    public retrieveData(): u256 {
        const storageKey = encodePointerHash(this.pointer, this.subPointer);
        return Blockchain.getStorageAt(storageKey, u256.Zero, u256.Zero);
    }
}
```

### 5. **Proofs and Integrity**

The cryptographic hashing ensures that each storage slot is uniquely identified by its `MemorySlotPointer`, preventing
collisions and ensuring that data stored in one slot cannot be overwritten or tampered with without detection.

When the data is stored or retrieved, the system generates cryptographic proofs that verify the integrity of the data.
This ensures that the data remains secure and has not been altered by unauthorized actors.

### Summary

Storage management in OP_NET using pointers and sub-pointers is a sophisticated process that leverages cryptographic
hashing to ensure data integrity and security. By combining a primary pointer with a sub-pointer, contracts can
efficiently manage complex data structures within their storage space. The use of hashing functions ensures that each
storage slot is uniquely and securely identified, preventing data collisions and ensuring that data remains
tamper-proof.
