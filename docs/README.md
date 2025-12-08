# Documentation

Welcome to the comprehensive documentation for **@btc-vision/btc-runtime**, the OPNet Smart Contract Runtime for Bitcoin
L1.

## What is btc-runtime?

btc-runtime is the foundational framework for building smart contracts on Bitcoin's base layer (L1). It provides:

- **Contract base classes** for building tokens (OP20), NFTs (OP721), and custom contracts
- **Storage primitives** for persisting data on-chain
- **SafeMath operations** for secure arithmetic
- **Event system** for state change notifications
- **Cryptographic utilities** including quantum-resistant signatures

## Documentation Overview

### Getting Started

New to OPNet? Start here:

| Document                                                    | Description                                  |
|-------------------------------------------------------------|----------------------------------------------|
| [Installation](./getting-started/installation.md)           | Setup your development environment           |
| [First Contract](./getting-started/first-contract.md)       | Build your first smart contract step-by-step |
| [Project Structure](./getting-started/project-structure.md) | Understand the directory layout              |

### Core Concepts

Understand the fundamentals:

| Document                                                            | Description                                |
|---------------------------------------------------------------------|--------------------------------------------|
| [Blockchain Environment](./core-concepts/blockchain-environment.md) | Runtime context and state access           |
| [Storage System](./core-concepts/storage-system.md)                 | How data persistence works                 |
| [Pointers](./core-concepts/pointers.md)                             | Storage key management                     |
| [Events](./core-concepts/events.md)                                 | Emitting and handling events               |
| [Decorators](./core-concepts/decorators.md)                         | @method, @returns, @emit, and ABIDataTypes |
| [Security](./core-concepts/security.md)                             | Security mechanisms and best practices     |

### Contract Standards

Build standardized contracts:

| Document                                            | Description                               |
|-----------------------------------------------------|-------------------------------------------|
| [OP_NET Base](./contracts/op-net-base.md)           | Abstract contract base class              |
| [OP20 Token](./contracts/op20-token.md)             | Fungible token standard (like ERC20)      |
| [OP20S Signatures](./contracts/op20s-signatures.md) | Gasless approval with signatures          |
| [OP721 NFT](./contracts/op721-nft.md)               | Non-fungible token standard (like ERC721) |
| [ReentrancyGuard](./contracts/reentrancy-guard.md)  | Reentrancy protection                     |

### Types & Utilities

Core types and helper utilities:

| Document                                             | Description                         |
|------------------------------------------------------|-------------------------------------|
| [Address](./types/address.md)                        | 32-byte address handling            |
| [SafeMath](./types/safe-math.md)                     | Overflow-safe arithmetic operations |
| [Calldata](./types/calldata.md)                      | Parsing input parameters            |
| [BytesWriter/Reader](./types/bytes-writer-reader.md) | Binary serialization                |

### Storage Types

Persist data on-chain:

| Document                                            | Description                               |
|-----------------------------------------------------|-------------------------------------------|
| [Stored Primitives](./storage/stored-primitives.md) | StoredU256, StoredString, etc.            |
| [Stored Arrays](./storage/stored-arrays.md)         | StoredU256Array, StoredAddressArray, etc. |
| [Stored Maps](./storage/stored-maps.md)             | StoredMapU256, key-value storage          |
| [Memory Maps](./storage/memory-maps.md)             | AddressMemoryMap, in-memory collections   |

### Advanced Topics

Deep dives for experienced developers:

| Document                                                       | Description                      |
|----------------------------------------------------------------|----------------------------------|
| [Cross-Contract Calls](./advanced/cross-contract-calls.md)     | Inter-contract communication     |
| [Signature Verification](./advanced/signature-verification.md) | Schnorr and ML-DSA signatures    |
| [Quantum Resistance](./advanced/quantum-resistance.md)         | ML-DSA quantum-safe cryptography |
| [Bitcoin Scripts](./advanced/bitcoin-scripts.md)               | Script building and timelocks    |
| [Plugins](./advanced/plugins.md)                               | Extending contract functionality |

### Examples

Complete, working examples:

| Document                                                     | Description                               |
|--------------------------------------------------------------|-------------------------------------------|
| [Basic Token](./examples/basic-token.md)                     | Simple OP20 token                         |
| [NFT with Reservations](./examples/nft-with-reservations.md) | Advanced NFT with time-based logic        |
| [Stablecoin](./examples/stablecoin.md)                       | Role-based access, pausability, blacklist |
| [Oracle Integration](./examples/oracle-integration.md)       | Multi-oracle price aggregation            |

### API Reference

Complete method signatures:

| Document                                    | Description                   |
|---------------------------------------------|-------------------------------|
| [Blockchain](./api-reference/blockchain.md) | BlockchainEnvironment methods |
| [OP20](./api-reference/op20.md)             | OP20 token standard API       |
| [OP721](./api-reference/op721.md)           | OP721 NFT standard API        |
| [SafeMath](./api-reference/safe-math.md)    | SafeMath function reference   |
| [Storage](./api-reference/storage.md)       | Storage class reference       |
| [Events](./api-reference/events.md)         | Event class reference         |

## Quick Links

- [Main README](../README.md)
- [Security Policy](../SECURITY.md)
- [GitHub Repository](https://github.com/btc-vision/btc-runtime)
- [OPNet Website](https://opnet.org)

## Solidity Developer?

If you're coming from Ethereum/Solidity development, check out
the [Solidity Comparison](./getting-started/first-contract.md#solidity-comparison) section in the First Contract guide.

## Need Help?

- **Issues**: [GitHub Issues](https://github.com/btc-vision/btc-runtime/issues)
- **Security**: [SECURITY.md](../SECURITY.md)
