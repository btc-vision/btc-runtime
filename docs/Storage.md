### Storage Management in OP_NET Contracts

When working with OP_NET contracts using AssemblyScript, managing storage is a critical aspect of developing robust and
reliable smart contracts. Unlike Solidity, where storage management is abstracted behind simpler syntax, AssemblyScript
provides a more granular approach, allowing developers to interact directly with storage slots. This guide will explain
the differences between storage management in Solidity and AssemblyScript, introduce the various classes available for
managing storage in OP_NET, and provide detailed examples to ensure you can effectively utilize these tools in your
smart contracts.

---

### 1. **Differences Between AssemblyScript and Solidity in Storage Management**

In Solidity, variables declared in the contract’s storage (outside of functions) are automatically persisted across
transactions. For example:

```solidity
pragma solidity ^0.8.0;

contract SimpleStorage {
    uint256 public storedData;

    function set(uint256 x) public {
        storedData = x;
    }
}
```

In this Solidity example, `storedData` is automatically stored in the contract’s storage and persists across function
calls. However, in AssemblyScript for OP_NET, simply declaring a variable in a contract class does not persist it in the
storage. Instead, storage in OP_NET is managed using explicit storage slots, which are mapped via pointers.

### 2. **Understanding Storage Slots in OP_NET**

Storage slots in OP_NET are composed of a pointer (`u16`) and a sub-pointer (`MemorySlotPointer`), both of which
are `u256` values. Each storage slot has associated proofs to ensure that the data is valid and not tampered with by bad
actors. To store data in these slots, OP_NET provides several specialized classes, each designed to handle different
types of data.

In AssemblyScript, simply declaring a variable does not ensure its persistence across contract invocations. For example:

```typescript
class MyContract extends OP_NET {
    private someValue: u64 = 1;

    private someMethod(): void {
        this.someValue = 2; // WARNING: THIS WILL NOT SAVE IN FUTURE EXECUTION!
    }
}
```

To persist data, you must use storage slots explicitly through the provided classes.

### 3. **Storage Classes in OP_NET**

#### **1. StoredBoolean**

`StoredBoolean` is a class that allows you to store a boolean value in a storage slot. The boolean value is represented
as `u256.One` for `true` and `u256.Zero` for `false`.

##### **Constructor Parameters:**

- **pointer**: `u16` - The primary pointer to the storage slot.
- **defaultValue**: `bool` - The default boolean value if no value is stored.

##### **Example Usage:**

```typescript
import { StoredBoolean } from '@btc-vision/btc-runtime/runtime';

class MyContract extends OP_NET {
    private isActive: StoredBoolean = new StoredBoolean(Blockchain.nextPointer, false);

    public toggleActive(): void {
        this.isActive.value = !this.isActive.value; // Toggle the active state
    }

    public getActiveState(): bool {
        return this.isActive.value; // Retrieve the current state
    }
}
```

##### **Equivalent Solidity Example:**

```solidity
pragma solidity ^0.8.0;

contract MyContract {
    bool public isActive = false;

    function toggleActive() public {
        isActive = !isActive;
    }

    function getActiveState() public view returns (bool) {
        return isActive;
    }
}
```

#### **2. StoredString**

`StoredString` is used to store string values in storage slots. It manages the complexity of splitting and storing
string data across multiple slots if the string exceeds a certain length.

##### **Constructor Parameters:**

- **pointer**: `u16` - The primary pointer to the storage slot.
- **defaultValue**: `string` - The default string value if no value is stored (optional).

##### **Example Usage:**

```typescript
import { StoredString } from '@btc-vision/btc-runtime/runtime';

class MyContract extends OP_NET {
    private storedName: StoredString = new StoredString(Blockchain.nextPointer, "default");

    public setName(name: string): void {
        this.storedName.value = name;
    }

    public getName(): string {
        return this.storedName.value;
    }
}
```

##### **Equivalent Solidity Example:**

```solidity
pragma solidity ^0.8.0;

contract MyContract {
    string public storedName = "default";

    function setName(string memory name) public {
        storedName = name;
    }

    function getName() public view returns (string memory) {
        return storedName;
    }
}
```

#### **3. StoredU256**

`StoredU256` is a class for storing `u256` values in storage slots. It supports basic arithmetic operations directly on
the stored values and ensures that the values are correctly persisted.

##### **Constructor Parameters:**

- **pointer**: `u16` - The primary pointer to the storage slot.
- **subPointer**: `MemorySlotPointer` - An additional pointer used for more granular control over storage within a
  primary slot.
- **defaultValue**: `u256` - The default value to be used if no value is stored.

##### **Example Usage:**

```typescript
import { StoredU256, MemorySlotPointer } from '@btc-vision/btc-runtime/runtime';
import { u256 } from 'as-bignum/assembly';

class MyContract extends OP_NET {
    private storedAmount: StoredU256 = new StoredU256(Blockchain.nextPointer, new MemorySlotPointer(0), u256.Zero);

    public addAmount(amount: u256): void {
        this.storedAmount.add(amount);
    }

    public getAmount(): u256 {
        return this.storedAmount.value;
    }
}
```

##### **Equivalent Solidity Example:**

```solidity
pragma solidity ^0.8.0;

contract MyContract {
    uint256 public storedAmount = 0;

    function addAmount(uint256 amount) public {
        storedAmount += amount;
    }

    function getAmount() public view returns (uint256) {
        return storedAmount;
    }
}
```

#### **4. AddressMemoryMap**

`AddressMemoryMap` allows for mapping between a string key (address) and a value stored in a memory slot. This is
particularly useful for implementing simple key-value stores within a contract.

##### **Constructor Parameters:**

- **pointer**: `u16` - The primary pointer to the storage slot.
- **defaultValue**: `MemorySlotData<u256>` - The default value to return if no value is stored at a particular key.

##### **Example Usage:**

```typescript
import { AddressMemoryMap } from '@btc-vision/btc-runtime/runtime';
import { u256 } from 'as-bignum/assembly';

class MyContract extends OP_NET {
    private balances: AddressMemoryMap<string, u256> = new AddressMemoryMap(Blockchain.nextPointer, u256.Zero);

    public setBalance(address: string, balance: u256): void {
        this.balances.set(address, balance);
    }

    public getBalance(address: string): u256 {
        return this.balances.get(address);
    }
}
```

##### **Equivalent Solidity Example:**

```solidity
pragma solidity ^0.8.0;

contract MyContract {
    mapping(string => uint256) public balances;

    function setBalance(string memory address, uint256 balance) public {
        balances[address] = balance;
    }

    function getBalance(string memory address) public view returns (uint256) {
        return balances[address];
    }
}
```

#### **5. MultiAddressMemoryMap**

`MultiAddressMemoryMap` is similar to `AddressMemoryMap`, but it allows for more complex mappings, such as a map within
a map, which is useful for multi-key mappings.

##### **Constructor Parameters:**

- **pointer**: `u16` - The primary pointer to the storage slot.
- **defaultValue**: `MemorySlotData<u256>` - The default value to return if no value is stored at a particular key.

##### **Example Usage:**

```typescript
import { MultiAddressMemoryMap } from '@btc-vision/btc-runtime/runtime';
import { u256 } from 'as-bignum/assembly';

class MyContract extends OP_NET {
    private allowances: MultiAddressMemoryMap<string, string, u256> = new MultiAddressMemoryMap(Blockchain.nextPointer, u256.Zero);

    public setAllowance(owner: string, spender: string, amount: u256): void {
        this.allowances.setUpperKey(owner, spender, amount);
    }

    public getAllowance(owner: string, spender: string): u256 {
        return this.allowances.get(owner).get(spender);
    }
}
```

##### **Equivalent Solidity Example:**

```solidity
pragma solidity ^0.8.0;

contract MyContract {
    mapping(string => mapping(string => uint256)) public allowances;

    function setAllowance(string memory owner, string memory spender, uint256 amount) public {
        allowances[owner][spender] = amount;
    }

    function getAllowance(string memory owner, string memory spender) public view returns (uint256) {
        return allowances[owner][spender];
    }
}
```

#### **6. Serializable**

`Serializable` is an abstract class that allows for storing complex objects by serializing them into chunks that are
saved across multiple storage slots. This class is useful for storing large or complex data structures.

##### **Constructor Parameters:**

- **pointer**: `u16` - The primary pointer to the storage slot.
- **subPointer**: `MemorySlotPointer` - An additional pointer used for more granular control over storage within a
  primary

slot.

##### **Example Usage:**

```typescript
import { Serializable, BytesWriter, BytesReader, MemorySlotPointer, Address } from '@btc-vision/btc-runtime/runtime';
import { u256 } from 'as-bignum/assembly';

class ComplexDataProps {
    public data: u256;
    public address: Address;

    constructor(data: u256, address: Address) {
        this.data = data;
        this.address = address;
    }
}

class ComplexData extends Serializable {
    private data: u256;

    constructor(pointer: u16, subPointer: MemorySlotPointer, data: u256, address: Address) {
        super(pointer, subPointer);
        this.data = data;
    }

    public get chunkCount(): i32 {
        return 3; // Example chunk count. Calculated via EXPECTED_DATA_LENGTH / 32.
    }

    public writeToBuffer(): BytesWriter {
        const writer = new BytesWriter();
        writer.writeU256(this.data); // this use 32 bytes
        writer.writeAddress(this.address); // this use 66 bytes
        return writer;
    }

    public getData(): ComplexDataProps {
        return new ComplexDataProps(this.data, this.address);
    }

    public setData(data: ComplexDataProps): void {
        this.data = data.data;
        this.address = data.address;
        this.save(); // Save the updated data to storage
    }

    public readFromBuffer(reader: BytesReader): void {
        this.data = reader.readU256();
        this.address = reader.readAddress();
    }
}
```

##### Using ComplexData in Your Contract

```typescript
import { ComplexData } from './ComplexData'; // Assuming ComplexData is in the same directory
import { u256 } from 'as-bignum/assembly';
import { OP_NET, MemorySlotPointer } from '@btc-vision/btc-runtime/runtime';

class MyContract extends OP_NET {
    private complexStorage: ComplexData;

    constructor() {
        super();

        const pointer: u16 = Blockchain.nextPointer;
        const subPointer: MemorySlotPointer = u256.fromU32(1); // Sub-pointer example
        const initialValue: u256 = u256.fromU32(42); // Example initial value

        // Initialize ComplexData with the specified pointer, subPointer, and initial value
        this.complexStorage = new ComplexData(pointer, subPointer, initialValue, "");

        // Load the existing data from storage (if any)
        this.complexStorage.load();
    }

    private updateComplexData(newValue: u256, newAddress: Address): void {
        // Update the value stored in ComplexData
        this.complexStorage.setData(newValue, newAddress);
    }

    private getComplexData(): ComplexDataProps {
        // Retrieve the value stored in ComplexData
        return this.complexStorage.getData();
    }
}
```

### Summary

Storage management in OP_NET requires a different mindset compared to Solidity. Understanding the explicit nature of
storage slots and how to effectively use the provided classes for different types of data is crucial for building
reliable and secure contracts. By leveraging classes
like `StoredBoolean`, `StoredString`, `StoredU256`, `AddressMemoryMap`, `MultiAddressMemoryMap`, and `Serializable`, you
can ensure that your contract’s state is efficiently managed and persists correctly across transactions.
