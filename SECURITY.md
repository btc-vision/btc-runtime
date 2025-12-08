# Security Policy

<p align="center">
  <a href="https://verichains.io">
    <img src="https://raw.githubusercontent.com/btc-vision/contract-logo/refs/heads/main/public-assets/verichains.png" alt="Verichains" width="300"/>
  </a>
</p>

<p align="center">
  <a href="https://verichains.io">
    <img src="https://img.shields.io/badge/Security%20Audit-Verichains-4C35E0?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMkw0IDV2Ni41YzAgNS4yNSAzLjQgMTAuMiA4IDExLjUgNC42LTEuMyA4LTYuMjUgOC0xMS41VjVsLTgtM3ptMCAxMC45OVYxOS41Yy0zLjQ1LTEuMTctNS45My00LjgtNi02LjVWNi4zTDEyIDRsMCA4Ljk5eiIgZmlsbD0id2hpdGUiLz48L3N2Zz4=" alt="Audited by Verichains"/>
  </a>
</p>

<p align="center">
  <strong>Professionally Audited by <a href="https://verichains.io">Verichains</a></strong>
</p>

## Audit Status

| Aspect                    | Status                              |
|---------------------------|-------------------------------------|
| **Auditor**               | [Verichains](https://verichains.io) |
| **Audit Date**            | 2025                                |
| **Report Status**         | Pending Publication                 |
| **Severity Issues Found** | All resolved                        |

## About the Audit

The OPNet Smart Contract Runtime has undergone a comprehensive security audit by [Verichains](https://verichains.io), a
leading blockchain security firm with extensive experience in:

- Smart contract security audits
- Blockchain protocol assessments
- Cryptographic implementation reviews
- WebAssembly security analysis

## Audit Scope

The security audit covered all core components of the btc-runtime:

### Contract Standards

- [x] **OP_NET Base Contract** - Abstract contract class, lifecycle hooks, method dispatching
- [x] **OP20 Token Standard** - Fungible token implementation, transfers, approvals, minting/burning
- [x] **OP20S Signatures** - Gasless approvals, EIP-712 typed signatures, nonce management
- [x] **OP721 NFT Standard** - Non-fungible tokens, ownership, enumeration, metadata
- [x] **ReentrancyGuard** - Reentrancy protection mechanisms (STANDARD and CALLBACK modes)

### Storage System

- [x] **Pointer Architecture** - u16 primary pointers, u256 sub-pointers, SHA256 key hashing
- [x] **Persistent Storage** - StoredU256, StoredString, StoredAddress, StoredBoolean
- [x] **Array Storage** - StoredU256Array through StoredU8Array, bounds checking
- [x] **Map Storage** - StoredMapU256, AddressMemoryMap, MapOfMap nested structures

### Cryptographic Operations

- [x] **Signature Verification** - Schnorr signatures, ML-DSA quantum-resistant signatures
- [x] **Hash Functions** - SHA256, double SHA256 (hash256)
- [x] **EIP-712 Domain Separator** - Typed data signing, replay protection
- [x] **Address Derivation** - P2TR, P2WSH, P2WPKH address generation

### Security Mechanisms

- [x] **SafeMath Operations** - Overflow/underflow protection for u256, u128, u64
- [x] **Access Control** - onlyDeployer patterns, role-based authorization
- [x] **Input Validation** - Calldata parsing, bounds checking, type verification
- [x] **Event System** - 352-byte limit enforcement, proper encoding

### Bitcoin Integration

- [x] **Transaction Parsing** - Input/output decoding, script parsing
- [x] **Address Validation** - Bitcoin address format verification
- [x] **Script Building** - Opcodes, CSV timelocks, witness structures
- [x] **Network Configuration** - Mainnet/testnet handling

## Supported Versions

| Version | Supported              |
|---------|------------------------|
| 1.10.x  | ✅ Current              |
| 1.9.x   | ⚠️ Upgrade recommended |
| < 1.9.0 | ❌ Not supported        |

## Security Best Practices

When developing contracts with btc-runtime, follow these guidelines:

### Use SafeMath for All Arithmetic

```typescript
import { SafeMath } from '@btc-vision/btc-runtime/runtime';

// CORRECT: Use SafeMath
const total = SafeMath.add(balance, amount);
const remaining = SafeMath.sub(balance, amount);

// WRONG: Direct arithmetic can overflow silently
// const total = balance + amount;  // DON'T DO THIS
```

### Always Validate Inputs

```typescript
class Test extends OP_NET {
    public transfer(calldata: Calldata): BytesWriter {
        const to = calldata.readAddress();
        const amount = calldata.readU256();

        // Validate recipient is not zero address
        if (to.equals(Address.zero())) {
            throw new Revert('Cannot transfer to zero address');
        }

        // Validate amount is positive
        if (amount.isZero()) {
            throw new Revert('Amount must be greater than zero');
        }

        // ... proceed with transfer
    }
}
```

### Use Reentrancy Guards

```typescript
import { ReentrancyGuard, ReentrancyGuardMode } from '@btc-vision/btc-runtime/runtime';

@final
export class MyContract extends ReentrancyGuard {
    constructor() {
        // Use CALLBACK mode for contracts with safe transfer callbacks
        super(ReentrancyGuardMode.CALLBACK);
    }
}
```

### Implement Access Control

```typescript
// Check deployer authorization
this.onlyDeployer(Blockchain.tx.sender);

// Custom role checks
class Test {
    private onlyAdmin(): void {
        if (!this.isAdmin(Blockchain.tx.sender)) {
            throw new Revert('Caller is not admin');
        }
    }
}
```

### Handle Cross-Contract Calls Safely

```typescript
const result = Blockchain.call(targetContract, calldata, true);

if (!result.success) {
    throw new Revert('External call failed');
}

// Parse and validate response
const response = result.data;
```

### Never Use Floating-Point Arithmetic

```typescript
// WRONG: Floating-point is non-deterministic
// const price = 1.5;  // DON'T USE FLOATS

// CORRECT: Use fixed-point with integers
const PRECISION = u256.fromU64(1_000_000); // 6 decimals
const price = SafeMath.mul(amount, PRECISION);
```

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

1. **DO NOT** open a public GitHub issue for security vulnerabilities
2. Report via [GitHub Security Advisories](https://github.com/btc-vision/btc-runtime/security/advisories)
3. Include detailed steps to reproduce the vulnerability
4. Allow reasonable time for a fix before public disclosure

### What to Include

- Description of the vulnerability
- Affected component(s) and version(s)
- Steps to reproduce
- Potential impact assessment
- Suggested fix (if any)
- Proof of concept (if applicable)

### Response Timeline

| Action                     | Timeframe           |
|----------------------------|---------------------|
| Initial response           | 48 hours            |
| Vulnerability confirmation | 7 days              |
| Patch development          | 14-30 days          |
| Public disclosure          | After patch release |

## Audit Report

The full audit report from Verichains will be published here upon completion of the disclosure process.

📄 **[Audit Report - Coming Soon]**

## Contact

- **Security Issues**: [GitHub Security Advisories](https://github.com/btc-vision/btc-runtime/security/advisories)
- **General Questions**: [GitHub Issues](https://github.com/btc-vision/btc-runtime/issues)
- **Website**: [OPNet](https://opnet.org)
- **Auditor**: [Verichains](https://verichains.io)

---

<p align="center">
  <sub>Security is a continuous process. This document will be updated as new audits are completed.</sub>
</p>
