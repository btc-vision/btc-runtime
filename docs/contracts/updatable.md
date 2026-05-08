# Updatable

The `Updatable` base class provides a secure update mechanism with configurable timelock protection. Contracts extending `Updatable` can replace their bytecode while giving users time to assess pending changes.

> **Alternative**: If you're already extending another base class (like `OP20` or `OP721`), use the [`UpdatablePlugin`](../advanced/updatable#using-the-updatableplugin) instead. Just call `this.registerPlugin(new UpdatablePlugin(144))` in your constructor - no other code changes needed!

## Overview

```typescript
import {
    Updatable,
    Calldata,
    BytesWriter,
    encodeSelector,
    Selector,
    ADDRESS_BYTE_LENGTH,
} from '@btc-vision/btc-runtime/runtime';

@final
export class MyContract extends Updatable {
    // Set delay: 144 blocks = ~24 hours
    protected readonly updateDelay: u64 = 144;

    public override execute(method: Selector, calldata: Calldata): BytesWriter {
        switch (method) {
            case encodeSelector('submitUpdate'):
                return this.submitUpdate(calldata.readAddress());
            case encodeSelector('applyUpdate'): {
                const sourceAddress = calldata.readAddress();
                const updateCalldata = calldata.readBytesWithLength();
                return this.applyUpdate(sourceAddress, updateCalldata);
            }
            case encodeSelector('cancelUpdate'):
                return this.cancelUpdate();
            default:
                return super.execute(method, calldata);
        }
    }
}
```

## Class Reference

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `updateDelay` | `u64` | Blocks to wait before update can be applied (default: 144 = ~24h) |
| `pendingUpdateAddress` | `Address` | Source address of pending update (zero if none) |
| `pendingUpdateBlock` | `u64` | Block when update was submitted (0 if none) |
| `updateEffectiveBlock` | `u64` | Block when update can be applied (0 if none) |
| `hasPendingUpdate` | `bool` | Whether an update is pending |
| `canApplyUpdate` | `bool` | Whether the delay has elapsed |

### Methods

#### submitUpdate

Submits an update for timelock. Only callable by deployer.

```typescript
protected submitUpdate(sourceAddress: Address): BytesWriter
```

**Parameters:**
- `sourceAddress`: The address of the contract containing the new bytecode

**Reverts if:**
- Caller is not the deployer
- Source is not a deployed contract
- An update is already pending

**Emits:** `UpdateSubmitted(sourceAddress, submitBlock, effectiveBlock)`

#### applyUpdate

Applies a pending update after the delay has passed. Only callable by deployer.

```typescript
protected applyUpdate(sourceAddress: Address, calldata: BytesWriter): BytesWriter
```

**Parameters:**
- `sourceAddress`: The source contract address (must match pending)
- `calldata`: Data passed to the `onUpdate` hook of the new contract

**Reverts if:**
- Caller is not the deployer
- No update is pending
- Delay has not elapsed
- Address does not match pending update

**Emits:** `UpdateApplied(sourceAddress, appliedAtBlock)`

#### cancelUpdate

Cancels a pending update. Only callable by deployer.

```typescript
protected cancelUpdate(): BytesWriter
```

**Reverts if:**
- Caller is not the deployer
- No update is pending

**Emits:** `UpdateCancelled(sourceAddress, cancelledAtBlock)`

## Events

### UpdateSubmittedEvent

Emitted when an update is submitted.

```typescript
class UpdateSubmittedEvent extends NetEvent {
    constructor(
        sourceAddress: Address,  // Contract with new bytecode
        submitBlock: u64,        // Block when submitted
        effectiveBlock: u64      // Block when can be applied
    )
}
```

### UpdateAppliedEvent

Emitted when an update is applied.

```typescript
class UpdateAppliedEvent extends NetEvent {
    constructor(
        sourceAddress: Address,  // Contract with new bytecode
        appliedAtBlock: u64      // Block when applied
    )
}
```

### UpdateCancelledEvent

Emitted when a pending update is cancelled.

```typescript
class UpdateCancelledEvent extends NetEvent {
    constructor(
        sourceAddress: Address,  // Cancelled source contract
        cancelledAtBlock: u64    // Block when cancelled
    )
}
```

## Usage Patterns

### Basic Updatable Contract

```typescript
@final
export class SimpleUpdatable extends Updatable {
    protected readonly updateDelay: u64 = 144; // ~1 day

    public override execute(method: Selector, calldata: Calldata): BytesWriter {
        switch (method) {
            case encodeSelector('submitUpdate'):
                return this.submitUpdate(calldata.readAddress());
            case encodeSelector('applyUpdate'): {
                const sourceAddress = calldata.readAddress();
                const updateCalldata = calldata.readBytesWithLength();
                return this.applyUpdate(sourceAddress, updateCalldata);
            }
            case encodeSelector('cancelUpdate'):
                return this.cancelUpdate();
            default:
                return super.execute(method, calldata);
        }
    }
}
```

### With Update Status Views

```typescript
@final
export class UpdatableWithViews extends Updatable {
    protected readonly updateDelay: u64 = 1008; // ~1 week

    public override execute(method: Selector, calldata: Calldata): BytesWriter {
        switch (method) {
            // Update actions
            case encodeSelector('submitUpdate'):
                return this.submitUpdate(calldata.readAddress());
            case encodeSelector('applyUpdate'): {
                const sourceAddress = calldata.readAddress();
                const updateCalldata = calldata.readBytesWithLength();
                return this.applyUpdate(sourceAddress, updateCalldata);
            }
            case encodeSelector('cancelUpdate'):
                return this.cancelUpdate();

            // View methods
            case encodeSelector('getPendingUpdate'):
                return this.getPendingUpdate();
            case encodeSelector('getUpdateStatus'):
                return this.getUpdateStatus();

            default:
                return super.execute(method, calldata);
        }
    }

    private getPendingUpdate(): BytesWriter {
        const response = new BytesWriter(32);
        response.writeAddress(this.pendingUpdateAddress);
        return response;
    }

    private getUpdateStatus(): BytesWriter {
        const response = new BytesWriter(17);
        response.writeBoolean(this.hasPendingUpdate);
        response.writeU64(this.pendingUpdateBlock);
        response.writeU64(this.updateEffectiveBlock);
        return response;
    }
}
```

### Emergency Updates (Not Recommended)

For contracts that need faster updates (use with caution):

```typescript
@final
export class QuickUpdatable extends Updatable {
    // Only 6 blocks (~1 hour) - use only for emergencies
    protected readonly updateDelay: u64 = 6;

    // ... rest of implementation
}
```

## Security Considerations

### 1. Delay Selection

Choose an appropriate delay based on your contract's risk profile:

| Contract Type | Recommended Delay |
|---------------|-------------------|
| Test/Development | 1-6 blocks |
| Standard DeFi | 144 blocks (~24 hours) |
| High-value vaults | 1008 blocks (~1 week) |
| Governance contracts | 4320 blocks (~1 month) |

### 2. Source Validation

The `submitUpdate` function validates that the source is a deployed contract. This prevents:
- Submitting non-existent addresses
- Last-minute malicious deployments

### 3. Address Match Verification

The `applyUpdate` function requires the address to match the pending update. This prevents:
- Front-running attacks
- Address substitution attacks

### 4. Storage Compatibility

When upgrading, ensure storage layout compatibility:

```typescript
// V1 - Original
class ContractV1 extends Updatable {
    private ptr1: u16 = Blockchain.nextPointer; // Pointer 1
    private ptr2: u16 = Blockchain.nextPointer; // Pointer 2
}

// V2 - Add new pointers at the END
class ContractV2 extends Updatable {
    private ptr1: u16 = Blockchain.nextPointer; // Pointer 1 (same)
    private ptr2: u16 = Blockchain.nextPointer; // Pointer 2 (same)
    private ptr3: u16 = Blockchain.nextPointer; // Pointer 3 (NEW)
}
```

## Update Workflow

```
1. Deploy new bytecode contract
   └─> Returns: newContractAddress

2. Submit update
   └─> submitUpdate(newContractAddress)
   └─> Emits: UpdateSubmitted

3. Wait for delay
   └─> Users can monitor and exit

4. Apply update
   └─> applyUpdate(newContractAddress)
   └─> Emits: UpdateApplied
   └─> VM calls onUpdate() on new bytecode
   └─> New bytecode active next block

5. (Optional) Discard source contract
   └─> Source contract can be abandoned
```

### The onUpdate Hook

Override `onUpdate` in your new contract version to perform migrations:

```typescript
@final
export class MyContractV2 extends Updatable {
    protected readonly updateDelay: u64 = 144;

    // New storage added in V2
    private newFeaturePointer: u16 = Blockchain.nextPointer;
    private _newFeature: StoredU256;

    public constructor() {
        super();
        this._newFeature = new StoredU256(this.newFeaturePointer, EMPTY_POINTER);
    }

    public override onUpdate(calldata: Calldata): void {
        super.onUpdate(calldata);
        // Initialize new storage
        this._newFeature.value = u256.fromU64(100);
    }

    // ... execute() and other methods
}
```

See [The onUpdate Lifecycle Hook](../advanced/updatable#the-onupdate-lifecycle-hook) for more details.

## Combining with Other Base Classes

### Updatable + ReentrancyGuard

```typescript
// Create a combined base class
class UpdatableWithReentrancy extends Updatable {
    protected readonly reentrancyLevel: ReentrancyLevel = ReentrancyLevel.STANDARD;
    private _locked: StoredBoolean;

    protected constructor() {
        super();
        this._locked = new StoredBoolean(Blockchain.nextPointer, false);
    }

    protected nonReentrant(): void {
        if (this._locked.value) {
            throw new Revert('ReentrancyGuard: LOCKED');
        }
        this._locked.value = true;
    }

    protected releaseGuard(): void {
        this._locked.value = false;
    }
}

@final
export class SecureUpdatableVault extends UpdatableWithReentrancy {
    // Implementation with both update and reentrancy protection
}
```

## Solidity Comparison

| Feature | OpenZeppelin UUPS | OP_NET Updatable |
|---------|-------------------|-------------------|
| Update mechanism | delegatecall | Native bytecode replacement |
| Storage location | Implementation contract | Same contract |
| Proxy overhead | Yes | No |
| Timelock | Separate contract (optional) | Built-in |
| Events | Custom | Built-in |
| Cancel update | Custom implementation | Built-in |

---

**Navigation:**
- Previous: [ReentrancyGuard](./reentrancy-guard.md)
- Next: [Address Type](../types/address.md)
