# OPNet Smart Contract Runtime

![Bitcoin](https://img.shields.io/badge/Bitcoin-000?style=for-the-badge&logo=bitcoin&logoColor=white)
![AssemblyScript](https://img.shields.io/badge/assembly%20script-%23000000.svg?style=for-the-badge&logo=assemblyscript&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![NodeJS](https://img.shields.io/badge/Node%20js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![WebAssembly](https://img.shields.io/badge/WebAssembly-654FF0?style=for-the-badge&logo=webassembly&logoColor=white)
![NPM](https://img.shields.io/badge/npm-CB3837?style=for-the-badge&logo=npm&logoColor=white)

[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

## Overview

The **OPNet Smart Contract Runtime** is the foundational framework for building decentralized applications directly on
Bitcoin Layer 1 (L1). Written in AssemblyScript and compiled to WebAssembly, btc-runtime enables developers to create,
deploy, and execute smart contracts on the Bitcoin network with the same expressiveness as Ethereum's Solidity.

Unlike Bitcoin Layer 2 solutions, OPNet operates directly on Bitcoin's base layer, inheriting Bitcoin's security
guarantees and decentralization properties while adding programmable smart contract capabilities.

> **What is OPNet?**
>
> OPNet (Open Protocol Network) is a consensus-layer built on Bitcoin L1. It allows developers to write smart
> contracts in AssemblyScript or similar that compile to WebAssembly (WASM) and execute deterministically across all
> network nodes. Think of it as "Solidity for Bitcoin" - you get the programmability of Ethereum with the security of
> Bitcoin.

> **Why AssemblyScript?**
>
> AssemblyScript compiles to WebAssembly, which provides:
> - **Deterministic execution** across all platforms and nodes
> - **Near-native performance** for compute-intensive operations
> - **Memory safety** through WASM's sandboxed environment
> - **Familiar syntax** for TypeScript/JavaScript developers

> **IMPORTANT: Floating-Point Arithmetic is Prohibited**
>
> Floating-point arithmetic (`f32`, `f64`) is **strictly prohibited** in blockchain and smart contract environments.
> Floating-point operations are **non-deterministic** across different CPU architectures, compilers, and platforms due
> to differences in rounding, precision, and IEEE 754 implementation details.
>
> **Always use integer arithmetic** (`u128`, `u256`) for all blockchain computations. For decimal values, use
> fixed-point representation (e.g., store currency as smallest units like satoshis). This library provides full support
> for 128-bit and 256-bit integer operations through [@btc-vision/as-bignum](https://github.com/btc-vision/as-bignum).

## Security Audit

<p align="center">
  <a href="https://verichains.io">
    <img src="https://raw.githubusercontent.com/btc-vision/contract-logo/refs/heads/main/public-assets/verichains.png" alt="Verichains" width="300"/>
  </a>
</p>

<p align="center">
  <a href="https://verichains.io">
    <img src="https://img.shields.io/badge/Security%20Audit-Verichains-4C35E0?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMkw0IDV2Ni41YzAgNS4yNSAzLjQgMTAuMiA4IDExLjUgNC42LTEuMyA4LTYuMjUgOC0xMS41VjVsLTgtM3ptMCAxMC45OVYxOS41Yy0zLjQ1LTEuMTctNS45My00LjgtNi02LjVWNi4zTDEyIDRsMCA4Ljk5eiIgZmlsbD0id2hpdGUiLz48L3N2Zz4=" alt="Audited by Verichains"/>
  </a>
  <a href="./SECURITY.md">
    <img src="https://img.shields.io/badge/Security-Report-22C55E?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNOSAxNi4xN0w0LjgzIDEybC0xLjQyIDEuNDFMOSAxOSAyMSA3bC0xLjQxLTEuNDFMOSAxNi4xN3oiIGZpbGw9IndoaXRlIi8+PC9zdmc+" alt="Security Report"/>
  </a>
</p>

This runtime has been professionally audited by [**Verichains**](https://verichains.io), a leading blockchain security
firm. The audit covered all core components including contract standards (OP20, OP721), storage systems, cryptographic
operations, and security mechanisms.

For full details, see [SECURITY.md](./SECURITY.md).

## Features

| Feature                      | Description                                                      |
|------------------------------|------------------------------------------------------------------|
| **Contract Standards**       | OP20 (fungible tokens), OP721 (NFTs), OP20S (gasless signatures) |
| **Storage System**           | Pointer-based persistent storage with SHA256 key hashing         |
| **SafeMath**                 | Overflow/underflow protection for all arithmetic operations      |
| **Reentrancy Protection**    | Built-in guards with STANDARD and CALLBACK modes                 |
| **Cryptographic Operations** | Schnorr signatures, ML-DSA (quantum-resistant), SHA256           |
| **Bitcoin Integration**      | Transaction parsing, address validation, script building         |
| **Event System**             | 352-byte events for state change notifications                   |
| **Cross-Contract Calls**     | Inter-contract communication with configurable failure handling  |

## Installation

```bash
npm install @btc-vision/btc-runtime
```

## Quick Start

### Your First Contract

Here's a minimal OP20 token contract to get you started:

```typescript
import { u256 } from '@btc-vision/as-bignum/assembly';
import {
    Blockchain,
    BytesWriter,
    Calldata,
    OP20,
    OP20InitParameters,
} from '@btc-vision/btc-runtime/runtime';

@final
export class MyToken extends OP20 {
    public constructor() {
        super();
        // NOTE: Constructor runs on EVERY interaction, not just deployment!
    }

    // This runs ONCE when the contract is deployed (like Solidity's constructor)
    public override onDeployment(_calldata: Calldata): void {
        const maxSupply: u256 = u256.fromString('1000000000000000000000000'); // 1 million tokens
        const decimals: u8 = 18;
        const name: string = 'MyToken';
        const symbol: string = 'MTK';

        this.instantiate(new OP20InitParameters(maxSupply, decimals, name, symbol));

        // Mint initial supply to deployer
        this._mint(Blockchain.tx.origin, maxSupply);
    }

    // Custom mint function (deployer only)
    public mint(calldata: Calldata): BytesWriter {
        this.onlyDeployer(Blockchain.tx.sender);

        const to = calldata.readAddress();
        const amount = calldata.readU256();
        this._mint(to, amount);

        return new BytesWriter(0);
    }
}
```

### Solidity Comparison

If you're coming from Solidity/EVM development, here's how OPNet concepts map:

| Solidity/EVM                | OPNet/btc-runtime                         | Notes                       |
|-----------------------------|-------------------------------------------|-----------------------------|
| `contract MyContract`       | `class MyContract extends OP_NET`         | Base class inheritance      |
| `constructor()`             | `onDeployment(calldata)`                  | Runs once at deployment     |
| `msg.sender`                | `Blockchain.tx.sender`                    | Immediate caller            |
| `tx.origin`                 | `Blockchain.tx.origin`                    | Original transaction signer |
| `block.number`              | `Blockchain.block.number`                 | Current block height        |
| `mapping(address => uint)`  | `AddressMemoryMap` + `StoredU256`         | Pointer-based storage       |
| `emit Transfer(...)`        | `this.emitEvent(new TransferEvent(...))`  | Event emission              |
| `ERC20`                     | `OP20`                                    | Fungible token standard     |
| `ERC721`                    | `OP721`                                   | Non-fungible token standard |
| `uint256`                   | `u256`                                    | 256-bit unsigned integer    |
| `require(condition, "msg")` | `if (!condition) throw new Revert("msg")` | Error handling              |
| `modifier onlyOwner`        | `this.onlyDeployer(sender)`               | Access control              |

## Documentation

Comprehensive documentation is available in the [docs/](./docs/) directory:

### Getting Started

- [Installation](./docs/getting-started/installation.md) - Setup and configuration
- [First Contract](./docs/getting-started/first-contract.md) - Step-by-step tutorial
- [Project Structure](./docs/getting-started/project-structure.md) - Directory layout

### Core Concepts

- [Blockchain Environment](./docs/core-concepts/blockchain-environment.md) - Runtime context
- [Storage System](./docs/core-concepts/storage-system.md) - How data persistence works
- [Pointers](./docs/core-concepts/pointers.md) - Storage key management
- [Events](./docs/core-concepts/events.md) - State change notifications
- [Security](./docs/core-concepts/security.md) - Protection mechanisms

### Contract Standards

- [OP_NET Base](./docs/contracts/op-net-base.md) - Abstract contract class
- [OP20 Token](./docs/contracts/op20-token.md) - Fungible token standard
- [OP20S Signatures](./docs/contracts/op20s-signatures.md) - Gasless approvals
- [OP721 NFT](./docs/contracts/op721-nft.md) - Non-fungible tokens
- [ReentrancyGuard](./docs/contracts/reentrancy-guard.md) - Reentrancy protection

### Types & Utilities

- [Address](./docs/types/address.md) - 32-byte address handling
- [SafeMath](./docs/types/safe-math.md) - Overflow-safe arithmetic
- [Calldata](./docs/types/calldata.md) - Input parsing
- [BytesWriter/Reader](./docs/types/bytes-writer-reader.md) - Serialization

### Storage Types

- [Stored Primitives](./docs/storage/stored-primitives.md) - Basic value storage
- [Stored Arrays](./docs/storage/stored-arrays.md) - Array storage
- [Stored Maps](./docs/storage/stored-maps.md) - Key-value storage
- [Memory Maps](./docs/storage/memory-maps.md) - In-memory mappings

### Advanced Topics

- [Cross-Contract Calls](./docs/advanced/cross-contract-calls.md) - Inter-contract communication
- [Signature Verification](./docs/advanced/signature-verification.md) - Cryptographic operations
- [Quantum Resistance](./docs/advanced/quantum-resistance.md) - ML-DSA support
- [Bitcoin Scripts](./docs/advanced/bitcoin-scripts.md) - Script building
- [Plugins](./docs/advanced/plugins.md) - Extending functionality

### Examples

- [Basic Token](./docs/examples/basic-token.md) - Simple OP20 implementation
- [NFT with Reservations](./docs/examples/nft-with-reservations.md) - Advanced NFT
- [Stablecoin](./docs/examples/stablecoin.md) - Role-based token
- [Oracle Integration](./docs/examples/oracle-integration.md) - Price feeds

### API Reference

- [Blockchain](./docs/api-reference/blockchain.md) - Environment methods
- [OP20](./docs/api-reference/op20.md) - Token standard API
- [OP721](./docs/api-reference/op721.md) - NFT standard API
- [SafeMath](./docs/api-reference/safe-math.md) - Math operations
- [Storage](./docs/api-reference/storage.md) - Storage classes
- [Events](./docs/api-reference/events.md) - Event classes

## Running Tests

```bash
# Run all tests with verbose output
npm test

# Run tests with summary only
npm run test:ci
```

## Project Structure

```
btc-runtime/
├── runtime/                    # Core runtime library
│   ├── contracts/              # Contract base classes (OP_NET, OP20, OP721)
│   ├── storage/                # Storage types (Stored*, Maps)
│   ├── math/                   # SafeMath operations
│   ├── types/                  # Core types (Address, Calldata)
│   ├── events/                 # Event system
│   └── env/                    # Blockchain environment
├── docs/                       # Documentation
└── tests/                      # Test suite
```

## Key Differences from Solidity

### 1. Constructor Behavior

```typescript
// OPNet: Constructor runs EVERY time
export class MyContract extends OP_NET {
    constructor() {
        super();
        // DON'T put initialization here - it runs on every call!
    }

    // Use this for one-time initialization (like Solidity constructor)
    public override onDeployment(calldata: Calldata): void {
        // Initialize storage here
    }
}
```

### 2. Storage is Explicit

```typescript
// Solidity: Implicit storage
// mapping(address => uint256) balances;

// OPNet: Explicit pointer allocation
class Test {
    private balancePointer: u16 = Blockchain.nextPointer;
    private balances: AddressMemoryMap<Address, StoredU256> = new AddressMemoryMap(
        this.balancePointer,
        u256.Zero
    );
}
```

### 3. Integer Types

```typescript
// OPNet uses u256 from as-bignum (NOT native BigInt)
import { u256 } from '@btc-vision/as-bignum/assembly';

const a = u256.from(100);
const b = u256.from(50);
const sum = SafeMath.add(a, b);  // Always use SafeMath!
```

### 4. No Floating Point

```typescript
// WRONG - Non-deterministic!
// const price: f64 = 1.5;

// CORRECT - Fixed-point with integers
const PRECISION: u256 = u256.fromU64(1_000_000); // 6 decimals
const price: u256 = SafeMath.mul(amount, PRECISION);
```

## Contributing

Contributions are welcome! Please ensure all tests pass before submitting a pull request.

```bash
npm test
```

## License

This project is licensed under the Apache-2.0 License. See [LICENSE](./LICENSE) for details.

## Links

- **Website**: [OPNet](https://opnet.org)
- **Documentation**: [docs/](./docs/)
- **Security**: [SECURITY.md](./SECURITY.md)
- **GitHub**: [btc-vision/btc-runtime](https://github.com/btc-vision/btc-runtime)
- **Issues**: [GitHub Issues](https://github.com/btc-vision/btc-runtime/issues)
- **Auditor**: [Verichains](https://verichains.io)
