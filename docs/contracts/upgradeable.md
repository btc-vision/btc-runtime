# Upgradeable

The `Upgradeable` base class provides a secure upgrade mechanism with configurable timelock protection. Contracts extending `Upgradeable` can replace their bytecode while giving users time to assess pending changes.

> **Alternative**: If you're already extending another base class (like `OP20` or `OP721`), use the [`UpgradeablePlugin`](../advanced/contract-upgrades.md#using-the-upgradeableplugin) instead. Just call `this.registerPlugin(new UpgradeablePlugin(144))` in your constructor - no other code changes needed!

## Overview

```typescript
import {
    Upgradeable,
    Calldata,
    BytesWriter,
    encodeSelector,
    Selector,
    ADDRESS_BYTE_LENGTH,
} from '@btc-vision/btc-runtime/runtime';

@final
export class MyContract extends Upgradeable {
    // Set delay: 144 blocks = ~24 hours
    protected readonly upgradeDelay: u64 = 144;

    public override execute(method: Selector, calldata: Calldata): BytesWriter {
        switch (method) {
            case encodeSelector('submitUpgrade'):
                return this.submitUpgrade(calldata.readAddress());
            case encodeSelector('applyUpgrade'): {
                const sourceAddress = calldata.readAddress();
                const remainingLength = calldata.byteLength - ADDRESS_BYTE_LENGTH;
                const updateCalldata = new BytesWriter(remainingLength);
                if (remainingLength > 0) {
                    updateCalldata.writeBytes(calldata.readBytes(remainingLength));
                }
                return this.applyUpgrade(sourceAddress, updateCalldata);
            }
            case encodeSelector('cancelUpgrade'):
                return this.cancelUpgrade();
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
| `upgradeDelay` | `u64` | Blocks to wait before upgrade can be applied (default: 144 = ~24h) |
| `pendingUpgradeAddress` | `Address` | Source address of pending upgrade (zero if none) |
| `pendingUpgradeBlock` | `u64` | Block when upgrade was submitted (0 if none) |
| `upgradeEffectiveBlock` | `u64` | Block when upgrade can be applied (0 if none) |
| `hasPendingUpgrade` | `bool` | Whether an upgrade is pending |
| `canApplyUpgrade` | `bool` | Whether the delay has elapsed |

### Methods

#### submitUpgrade

Submits an upgrade for timelock. Only callable by deployer.

```typescript
protected submitUpgrade(sourceAddress: Address): BytesWriter
```

**Parameters:**
- `sourceAddress`: The address of the contract containing the new bytecode

**Reverts if:**
- Caller is not the deployer
- Source is not a deployed contract
- An upgrade is already pending

**Emits:** `UpgradeSubmitted(sourceAddress, submitBlock, effectiveBlock)`

#### applyUpgrade

Applies a pending upgrade after the delay has passed. Only callable by deployer.

```typescript
protected applyUpgrade(sourceAddress: Address, calldata: BytesWriter): BytesWriter
```

**Parameters:**
- `sourceAddress`: The source contract address (must match pending)
- `calldata`: Data passed to the `onUpdate` hook of the new contract

**Reverts if:**
- Caller is not the deployer
- No upgrade is pending
- Delay has not elapsed
- Address does not match pending upgrade

**Emits:** `UpgradeApplied(sourceAddress, appliedAtBlock)`

#### cancelUpgrade

Cancels a pending upgrade. Only callable by deployer.

```typescript
protected cancelUpgrade(): BytesWriter
```

**Reverts if:**
- Caller is not the deployer
- No upgrade is pending

**Emits:** `UpgradeCancelled(sourceAddress, cancelledAtBlock)`

## Events

### UpgradeSubmittedEvent

Emitted when an upgrade is submitted.

```typescript
class UpgradeSubmittedEvent extends NetEvent {
    constructor(
        sourceAddress: Address,  // Contract with new bytecode
        submitBlock: u64,        // Block when submitted
        effectiveBlock: u64      // Block when can be applied
    )
}
```

### UpgradeAppliedEvent

Emitted when an upgrade is applied.

```typescript
class UpgradeAppliedEvent extends NetEvent {
    constructor(
        sourceAddress: Address,  // Contract with new bytecode
        appliedAtBlock: u64      // Block when applied
    )
}
```

### UpgradeCancelledEvent

Emitted when a pending upgrade is cancelled.

```typescript
class UpgradeCancelledEvent extends NetEvent {
    constructor(
        sourceAddress: Address,  // Cancelled source contract
        cancelledAtBlock: u64    // Block when cancelled
    )
}
```

## Usage Patterns

### Basic Upgradeable Contract

```typescript
@final
export class SimpleUpgradeable extends Upgradeable {
    protected readonly upgradeDelay: u64 = 144; // ~1 day

    public override execute(method: Selector, calldata: Calldata): BytesWriter {
        switch (method) {
            case encodeSelector('submitUpgrade'):
                return this.submitUpgrade(calldata.readAddress());
            case encodeSelector('applyUpgrade'): {
                const sourceAddress = calldata.readAddress();
                const remainingLength = calldata.byteLength - ADDRESS_BYTE_LENGTH;
                const updateCalldata = new BytesWriter(remainingLength);
                if (remainingLength > 0) {
                    updateCalldata.writeBytes(calldata.readBytes(remainingLength));
                }
                return this.applyUpgrade(sourceAddress, updateCalldata);
            }
            case encodeSelector('cancelUpgrade'):
                return this.cancelUpgrade();
            default:
                return super.execute(method, calldata);
        }
    }
}
```

### With Upgrade Status Views

```typescript
@final
export class UpgradeableWithViews extends Upgradeable {
    protected readonly upgradeDelay: u64 = 1008; // ~1 week

    public override execute(method: Selector, calldata: Calldata): BytesWriter {
        switch (method) {
            // Upgrade actions
            case encodeSelector('submitUpgrade'):
                return this.submitUpgrade(calldata.readAddress());
            case encodeSelector('applyUpgrade'): {
                const sourceAddress = calldata.readAddress();
                const remainingLength = calldata.byteLength - ADDRESS_BYTE_LENGTH;
                const updateCalldata = new BytesWriter(remainingLength);
                if (remainingLength > 0) {
                    updateCalldata.writeBytes(calldata.readBytes(remainingLength));
                }
                return this.applyUpgrade(sourceAddress, updateCalldata);
            }
            case encodeSelector('cancelUpgrade'):
                return this.cancelUpgrade();

            // View methods
            case encodeSelector('getPendingUpgrade'):
                return this.getPendingUpgrade();
            case encodeSelector('getUpgradeStatus'):
                return this.getUpgradeStatus();

            default:
                return super.execute(method, calldata);
        }
    }

    private getPendingUpgrade(): BytesWriter {
        const response = new BytesWriter(32);
        response.writeAddress(this.pendingUpgradeAddress);
        return response;
    }

    private getUpgradeStatus(): BytesWriter {
        const response = new BytesWriter(17);
        response.writeBoolean(this.hasPendingUpgrade);
        response.writeU64(this.pendingUpgradeBlock);
        response.writeU64(this.upgradeEffectiveBlock);
        return response;
    }
}
```

### Emergency Upgrades (Not Recommended)

For contracts that need faster upgrades (use with caution):

```typescript
@final
export class QuickUpgradeable extends Upgradeable {
    // Only 6 blocks (~1 hour) - use only for emergencies
    protected readonly upgradeDelay: u64 = 6;

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

The `submitUpgrade` function validates that the source is a deployed contract. This prevents:
- Submitting non-existent addresses
- Last-minute malicious deployments

### 3. Address Match Verification

The `applyUpgrade` function requires the address to match the pending upgrade. This prevents:
- Front-running attacks
- Address substitution attacks

### 4. Storage Compatibility

When upgrading, ensure storage layout compatibility:

```typescript
// V1 - Original
class ContractV1 extends Upgradeable {
    private ptr1: u16 = Blockchain.nextPointer; // Pointer 1
    private ptr2: u16 = Blockchain.nextPointer; // Pointer 2
}

// V2 - Add new pointers at the END
class ContractV2 extends Upgradeable {
    private ptr1: u16 = Blockchain.nextPointer; // Pointer 1 (same)
    private ptr2: u16 = Blockchain.nextPointer; // Pointer 2 (same)
    private ptr3: u16 = Blockchain.nextPointer; // Pointer 3 (NEW)
}
```

## Upgrade Workflow

```
1. Deploy new bytecode contract
   └─> Returns: newContractAddress

2. Submit upgrade
   └─> submitUpgrade(newContractAddress)
   └─> Emits: UpgradeSubmitted

3. Wait for delay
   └─> Users can monitor and exit

4. Apply upgrade
   └─> applyUpgrade(newContractAddress)
   └─> Emits: UpgradeApplied
   └─> VM calls onUpdate() on new bytecode
   └─> New bytecode active next block

5. (Optional) Discard source contract
   └─> Source contract can be abandoned
```

### The onUpdate Hook

Override `onUpdate` in your new contract version to perform migrations:

```typescript
@final
export class MyContractV2 extends Upgradeable {
    protected readonly upgradeDelay: u64 = 144;

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

See [The onUpdate Lifecycle Hook](../advanced/contract-upgrades.md#the-onupdate-lifecycle-hook) for more details.

## Combining with Other Base Classes

### Upgradeable + ReentrancyGuard

```typescript
// Create a combined base class
class UpgradeableWithReentrancy extends Upgradeable {
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
export class SecureUpgradeableVault extends UpgradeableWithReentrancy {
    // Implementation with both upgrade and reentrancy protection
}
```

## Solidity Comparison

| Feature | OpenZeppelin UUPS | OPNet Upgradeable |
|---------|-------------------|-------------------|
| Upgrade mechanism | delegatecall | Native bytecode replacement |
| Storage location | Implementation contract | Same contract |
| Proxy overhead | Yes | No |
| Timelock | Separate contract (optional) | Built-in |
| Events | Custom | Built-in |
| Cancel upgrade | Custom implementation | Built-in |

---

**Navigation:**
- Previous: [ReentrancyGuard](./reentrancy-guard.md)
- Next: [Address Type](../types/address.md)
