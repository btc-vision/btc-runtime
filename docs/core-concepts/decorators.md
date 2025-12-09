# Decorators

Decorators are essential for OPNet smart contracts. They define the ABI (Application Binary Interface) that allows external callers to interact with your contract methods.

## Overview

OPNet uses three main decorators:

| Decorator | Purpose |
|-----------|---------|
| `@method()` | Defines input parameters for a contract method |
| `@returns()` | Defines return values for a contract method |
| `@emit()` | Specifies which event a method emits |

```typescript
import { OP_NET, Calldata, BytesWriter, ABIDataTypes } from '@btc-vision/btc-runtime/runtime';

@final
class MyContract extends OP_NET {
    public constructor() {
        super();
    }

    @method({ name: 'recipient', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    @emit('Transferred')
    public transfer(calldata: Calldata): BytesWriter {
        const recipient = calldata.readAddress();
        // ... implementation
        const writer = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }
}
```

### Decorator Flow and ABI Generation

```mermaid
---
config:
  theme: dark
---
flowchart LR
    Start["Contract Source Code"] --> Parse["Compiler"]
    Parse --> Extract["Extract Decorators"]
    Extract --> Build["Build ABI Entry"]
    Build --> Gen["Generate Selector<br/>SHA256 -> u32"]
    Gen --> Output["abi.json"]
```

## Solidity Comparison

OPNet decorators serve the same purpose as Solidity's function signatures but are more explicit:

| Solidity | OPNet |
|----------|-------|
| `function name() public view returns (string)` | `@method() @returns({ name: 'name', type: ABIDataTypes.STRING })` |
| `function balanceOf(address owner) public view returns (uint256)` | `@method({ name: 'owner', type: ABIDataTypes.ADDRESS }) @returns({ name: 'balance', type: ABIDataTypes.UINT256 })` |
| `function transfer(address to, uint256 amount) public` | `@method({ name: 'to', type: ABIDataTypes.ADDRESS }, { name: 'amount', type: ABIDataTypes.UINT256 })` |
| `event Transfer(address from, address to, uint256 amount)` | `@emit('Transferred')` |

## ABIDataTypes

The `ABIDataTypes` enum defines all supported parameter and return types:

### Numeric Types

| Type | Description | Size |
|------|-------------|------|
| `ABIDataTypes.UINT8` | Unsigned 8-bit integer | 1 byte |
| `ABIDataTypes.UINT16` | Unsigned 16-bit integer | 2 bytes |
| `ABIDataTypes.UINT32` | Unsigned 32-bit integer | 4 bytes |
| `ABIDataTypes.UINT64` | Unsigned 64-bit integer | 8 bytes |
| `ABIDataTypes.UINT128` | Unsigned 128-bit integer | 16 bytes |
| `ABIDataTypes.UINT256` | Unsigned 256-bit integer | 32 bytes |

### Address and Bytes Types

| Type | Description | Size |
|------|-------------|------|
| `ABIDataTypes.ADDRESS` | OPNet address | 32 bytes |
| `ABIDataTypes.BYTES` | Variable-length bytes | Variable |
| `ABIDataTypes.BYTES32` | Fixed 32-byte value | 32 bytes |

### Other Types

| Type | Description | Size |
|------|-------------|------|
| `ABIDataTypes.BOOL` | Boolean value | 1 byte |
| `ABIDataTypes.STRING` | UTF-8 string | Variable |

### Array Types

| Type | Description |
|------|-------------|
| `ABIDataTypes.ADDRESS_ARRAY` | Array of addresses |
| `ABIDataTypes.BYTES_ARRAY` | Array of byte arrays |
| `ABIDataTypes.UINT256_ARRAY` | Array of u256 values |

## @method Decorator

The `@method` decorator defines input parameters for a contract method.

### No Parameters

```typescript
@method()
@returns({ name: 'supply', type: ABIDataTypes.UINT256 })
public totalSupply(_: Calldata): BytesWriter {
    const writer = new BytesWriter(32);
    writer.writeU256(this._totalSupply.value);
    return writer;
}
```

### Single Parameter

```typescript
@method({ name: 'owner', type: ABIDataTypes.ADDRESS })
@returns({ name: 'balance', type: ABIDataTypes.UINT256 })
public balanceOf(calldata: Calldata): BytesWriter {
    const owner = calldata.readAddress();
    const balance = this._balances.get(owner);

    const writer = new BytesWriter(32);
    writer.writeU256(balance);
    return writer;
}
```

### Multiple Parameters

```typescript
@method(
    { name: 'to', type: ABIDataTypes.ADDRESS },
    { name: 'amount', type: ABIDataTypes.UINT256 },
)
@emit('Transferred')
public transfer(calldata: Calldata): BytesWriter {
    const to = calldata.readAddress();
    const amount = calldata.readU256();

    this._transfer(Blockchain.tx.sender, to, amount);

    return new BytesWriter(0);
}
```

### Complex Parameters

```typescript
@method(
    { name: 'owner', type: ABIDataTypes.ADDRESS },
    { name: 'spender', type: ABIDataTypes.ADDRESS },
    { name: 'value', type: ABIDataTypes.UINT256 },
    { name: 'deadline', type: ABIDataTypes.UINT64 },
    { name: 'signature', type: ABIDataTypes.BYTES },
)
@emit('Approved')
public permit(calldata: Calldata): BytesWriter {
    const owner = calldata.readAddress();
    const spender = calldata.readAddress();
    const value = calldata.readU256();
    const deadline = calldata.readU64();
    const signature = calldata.readBytesWithLength();

    // ... implementation
    return new BytesWriter(0);
}
```

### Named Method Override

When your method name differs from the ABI name:

```typescript
@method('name')  // ABI will use 'name' as the method name
@returns({ name: 'name', type: ABIDataTypes.STRING })
public fn_name(_: Calldata): BytesWriter {
    // Method is called 'fn_name' in code but 'name' in ABI
    const writer = new BytesWriter(this._name.value.length + 4);
    writer.writeString(this._name.value);
    return writer;
}
```

## @returns Decorator

The `@returns` decorator defines return values for a contract method.

### Single Return Value

```typescript
@method()
@returns({ name: 'decimals', type: ABIDataTypes.UINT8 })
public decimals(_: Calldata): BytesWriter {
    const writer = new BytesWriter(1);
    writer.writeU8(this._decimals.value);
    return writer;
}
```

### Multiple Return Values

```typescript
@method()
@returns(
    { name: 'name', type: ABIDataTypes.STRING },
    { name: 'symbol', type: ABIDataTypes.STRING },
    { name: 'decimals', type: ABIDataTypes.UINT8 },
    { name: 'totalSupply', type: ABIDataTypes.UINT256 },
)
public metadata(_: Calldata): BytesWriter {
    const writer = new BytesWriter(256);
    writer.writeString(this._name.value);
    writer.writeString(this._symbol.value);
    writer.writeU8(this._decimals.value);
    writer.writeU256(this._totalSupply.value);
    return writer;
}
```

### No Return Value

Methods that only mutate state:

```typescript
@method(
    { name: 'to', type: ABIDataTypes.ADDRESS },
    { name: 'amount', type: ABIDataTypes.UINT256 },
)
@emit('Transferred')
public transfer(calldata: Calldata): BytesWriter {
    const to = calldata.readAddress();
    const amount = calldata.readU256();

    this._transfer(Blockchain.tx.sender, to, amount);

    return new BytesWriter(0);  // Empty return
}
```

## @emit Decorator

The `@emit` decorator specifies which event a method emits. This is used for ABI generation but doesn't automatically emit the event - you must call `this.emitEvent()` in your implementation.

```typescript
@method(
    { name: 'to', type: ABIDataTypes.ADDRESS },
    { name: 'amount', type: ABIDataTypes.UINT256 },
)
@emit('Transferred')  // Indicates this method emits Transferred event
public transfer(calldata: Calldata): BytesWriter {
    const to = calldata.readAddress();
    const amount = calldata.readU256();
    const from = Blockchain.tx.sender;

    this._transfer(from, to, amount);

    // You must still emit the event manually
    this.emitEvent(new TransferredEvent(from, from, to, amount));

    return new BytesWriter(0);
}
```

### How Decorators Work Together

```mermaid
---
config:
  theme: dark
---
flowchart LR
    Code["Method with Decorators"] --> Extract["Extract Metadata"]
    Extract --> GenSig["Generate Signature"]
    GenSig --> Selector["Selector: 0xABCD1234"]
    Selector --> ABI["ABI Entry"]
    ABI --> Call["External Call"]
    Call --> Match{"Match?"}
    Match -->|Yes| Execute["Execute Method"]
    Match -->|No| Next["Next Method"]
    Execute --> Return["Return Result"]
```

## Complete Examples

### Simple Getter

```typescript
@method()
@returns({ name: 'owner', type: ABIDataTypes.ADDRESS })
public owner(_: Calldata): BytesWriter {
    const writer = new BytesWriter(32);
    writer.writeAddress(this._owner.value);
    return writer;
}
```

### Getter with Parameter

```typescript
@method({ name: 'tokenId', type: ABIDataTypes.UINT256 })
@returns({ name: 'owner', type: ABIDataTypes.ADDRESS })
public ownerOf(calldata: Calldata): BytesWriter {
    const tokenId = calldata.readU256();
    const owner = this._owners.get(tokenId);

    if (owner.isZero()) {
        throw new Revert('Token does not exist');
    }

    const writer = new BytesWriter(32);
    writer.writeAddress(owner);
    return writer;
}
```

### State-Mutating Method

```typescript
@method(
    { name: 'spender', type: ABIDataTypes.ADDRESS },
    { name: 'amount', type: ABIDataTypes.UINT256 },
)
@emit('Approved')
public approve(calldata: Calldata): BytesWriter {
    const spender = calldata.readAddress();
    const amount = calldata.readU256();
    const owner = Blockchain.tx.sender;

    this._approve(owner, spender, amount);
    this.emitEvent(new ApprovedEvent(owner, spender, amount));

    return new BytesWriter(0);
}
```

### Method with Bytes Input

```typescript
@method(ABIDataTypes.BYTES)  // Shorthand for { name: 'data', type: ABIDataTypes.BYTES }
@returns({ name: 'valid', type: ABIDataTypes.BOOL })
public verifySignature(calldata: Calldata): BytesWriter {
    const signature = calldata.readBytesWithLength();

    const message = new BytesWriter(32);
    message.writeString('Sign this message');
    const messageHash = sha256(message.getBuffer());

    const isValid = Blockchain.verifySignature(
        Blockchain.tx.origin,
        signature,
        messageHash,
        true
    );

    const writer = new BytesWriter(1);
    writer.writeBoolean(isValid);
    return writer;
}
```

### Full Token Transfer

```typescript
@method(
    { name: 'from', type: ABIDataTypes.ADDRESS },
    { name: 'to', type: ABIDataTypes.ADDRESS },
    { name: 'amount', type: ABIDataTypes.UINT256 },
)
@emit('Transferred')
public transferFrom(calldata: Calldata): BytesWriter {
    const from = calldata.readAddress();
    const to = calldata.readAddress();
    const amount = calldata.readU256();
    const spender = Blockchain.tx.sender;

    // Check and update allowance
    const currentAllowance = this._allowances.get(from).get(spender);
    if (currentAllowance < amount) {
        throw new Revert('Insufficient allowance');
    }

    // Deduct from allowance (unless unlimited)
    if (currentAllowance != u256.Max) {
        this._allowances.get(from).set(spender, SafeMath.sub(currentAllowance, amount));
    }

    // Transfer
    this._transfer(from, to, amount);
    this.emitEvent(new TransferredEvent(spender, from, to, amount));

    return new BytesWriter(0);
}
```

## Best Practices

### 1. Always Use Decorators for Public Methods

```typescript
// Good - properly decorated
@method({ name: 'amount', type: ABIDataTypes.UINT256 })
@emit('Burned')
public burn(calldata: Calldata): BytesWriter {
    // ...
    return new BytesWriter(0);
}

// Bad - no decorators
public burn(calldata: Calldata): BytesWriter {
    // Callers won't know the ABI
    return new BytesWriter(0);
}
```

### 2. Match Read Order with Parameter Order

```typescript
@method(
    { name: 'to', type: ABIDataTypes.ADDRESS },
    { name: 'amount', type: ABIDataTypes.UINT256 },
)
public transfer(calldata: Calldata): BytesWriter {
    // Read in same order as @method parameters
    const to = calldata.readAddress();       // First
    const amount = calldata.readU256();      // Second
    // ...
}
```

### 3. Use Descriptive Names

```typescript
// Good - clear names
@method({ name: 'recipient', type: ABIDataTypes.ADDRESS })
@returns({ name: 'success', type: ABIDataTypes.BOOL })

// Less clear
@method({ name: 'a', type: ABIDataTypes.ADDRESS })
@returns({ name: 'r', type: ABIDataTypes.BOOL })
```

### 4. Group Related Returns

```typescript
@method()
@returns(
    { name: 'name', type: ABIDataTypes.STRING },
    { name: 'symbol', type: ABIDataTypes.STRING },
    { name: 'decimals', type: ABIDataTypes.UINT8 },
    { name: 'totalSupply', type: ABIDataTypes.UINT256 },
    { name: 'domainSeparator', type: ABIDataTypes.BYTES32 },
)
public metadata(_: Calldata): BytesWriter {
    // Single call returns all token metadata
}
```

---

**Navigation:**
- Previous: [Events](./events.md)
- Next: [Security](./security.md)
