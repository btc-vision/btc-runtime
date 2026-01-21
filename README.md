# OPNet Smart Contract Runtime

![Bitcoin](https://img.shields.io/badge/Bitcoin-000?style=for-the-badge&logo=bitcoin&logoColor=white)
![AssemblyScript](https://img.shields.io/badge/assembly%20script-%23000000.svg?style=for-the-badge&logo=assemblyscript&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![NodeJS](https://img.shields.io/badge/Node%20js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![WebAssembly](https://img.shields.io/badge/WebAssembly-654FF0?style=for-the-badge&logo=webassembly&logoColor=white)
![NPM](https://img.shields.io/badge/npm-CB3837?style=for-the-badge&logo=npm&logoColor=white)

[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

## Overview

The OPNet Smart Contract Runtime is the framework for building decentralized applications on Bitcoin L1. Written in AssemblyScript and compiled to WebAssembly, it enables smart contract development on Bitcoin with similar expressiveness to Solidity.

Unlike Bitcoin Layer 2 solutions, OPNet operates directly on Bitcoin's base layer, inheriting Bitcoin's security guarantees and decentralization properties while adding programmable smart contract capabilities.

> **What is OPNet?**
>
> OPNet (Open Protocol Network) is a consensus-layer built on Bitcoin L1. It allows developers to write smart contracts in AssemblyScript or similar that compile to WebAssembly (WASM) and execute deterministically across all network nodes. Think of it as "Solidity for Bitcoin" - you get the programmability of Ethereum with the security of Bitcoin.

> **Why AssemblyScript?**
>
> AssemblyScript compiles to WebAssembly, which provides:
> - **Deterministic execution** across all platforms and nodes
> - **Near-native performance** for compute-intensive operations
> - **Memory safety** through WASM's sandboxed environment
> - **Familiar syntax** for TypeScript/JavaScript developers

> **Floating-Point Arithmetic is Prohibited**
>
> Floating-point arithmetic (`f32`, `f64`) is **strictly prohibited** in blockchain and smart contract environments. Floating-point operations are non-deterministic across different CPU architectures, compilers, and platforms due to differences in rounding, precision, and IEEE 754 implementation details.
>
> **Always use integer arithmetic** (`u128`, `u256`) for all blockchain computations. For decimal values, use fixed-point representation (e.g., store currency as smallest units like satoshis). This library provides full support for 128-bit and 256-bit integer operations through [@btc-vision/as-bignum](https://github.com/btc-vision/as-bignum).

## Security Audit

<p align="center">
  <a href="https://verichains.io">
    <img src="https://raw.githubusercontent.com/btc-vision/contract-logo/refs/heads/main/public-assets/verichains.png" alt="Verichains" width="100"/>
  </a>
</p>

<p align="center">
  <a href="https://verichains.io">
    <img src="https://img.shields.io/badge/Security%20Audit-Verichains-4C35E0?style=for-the-badge" alt="Audited by Verichains"/>
  </a>
  <a href="./SECURITY.md">
    <img src="https://img.shields.io/badge/Security-Report-22C55E?style=for-the-badge" alt="Security Report"/>
  </a>
</p>

This runtime has been professionally audited by [Verichains](https://verichains.io).

See [SECURITY.md](./SECURITY.md) for details.

## Installation

```bash
npm install @btc-vision/btc-runtime
```

## Quick Start

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
    public override onDeployment(_calldata: Calldata): void {
        const maxSupply: u256 = u256.fromString('1000000000000000000000000');
        const decimals: u8 = 18;
        const name: string = 'MyToken';
        const symbol: string = 'MTK';

        this.instantiate(new OP20InitParameters(maxSupply, decimals, name, symbol));
        this._mint(Blockchain.tx.origin, maxSupply);
    }
}
```

## Solidity Comparison

| Solidity/EVM                | OPNet/btc-runtime                         |
|-----------------------------|-------------------------------------------|
| `contract MyContract`       | `class MyContract extends OP_NET`         |
| `constructor()`             | `onDeployment(calldata)`                  |
| `msg.sender`                | `Blockchain.tx.sender`                    |
| `tx.origin`                 | `Blockchain.tx.origin`                    |
| `block.number`              | `Blockchain.block.number`                 |
| `mapping(address => uint)`  | `AddressMemoryMap` + `StoredU256`         |
| `emit Transfer(...)`        | `this.emitEvent(new TransferEvent(...))` |
| `ERC20`                     | `OP20`                                    |
| `ERC721`                    | `OP721`                                   |
| `require(condition, "msg")` | `if (!condition) throw new Revert("msg")` |

## Documentation

Documentation is available in [docs/](./docs/):

- **Getting Started**: [Installation](./docs/getting-started/installation.md), [First Contract](./docs/getting-started/first-contract.md), [Project Structure](./docs/getting-started/project-structure.md)
- **Core Concepts**: [Blockchain Environment](./docs/core-concepts/blockchain-environment.md), [Storage System](./docs/core-concepts/storage-system.md), [Pointers](./docs/core-concepts/pointers.md), [Events](./docs/core-concepts/events.md), [Security](./docs/core-concepts/security.md)
- **Contract Standards**: [OP_NET Base](./docs/contracts/op-net-base.md), [OP20](./docs/contracts/op20-token.md), [OP20S](./docs/contracts/op20s-signatures.md), [OP721](./docs/contracts/op721-nft.md)
- **Storage Types**: [Stored Primitives](./docs/storage/stored-primitives.md), [Stored Arrays](./docs/storage/stored-arrays.md), [Stored Maps](./docs/storage/stored-maps.md), [Memory Maps](./docs/storage/memory-maps.md)
- **Advanced**: [Cross-Contract Calls](./docs/advanced/cross-contract-calls.md), [Signature Verification](./docs/advanced/signature-verification.md), [Quantum Resistance](./docs/advanced/quantum-resistance.md)

## Running Tests

```bash
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

See the [pull request template](./.github/PULL_REQUEST_TEMPLATE.md) for requirements.

## Reporting Issues

- **Bugs**: Use the [bug report template](https://github.com/btc-vision/btc-runtime/issues/new?template=bug_report.yml)
- **Security**: See [SECURITY.md](./SECURITY.md) - do not open public issues for vulnerabilities

## License

[Apache-2.0](./LICENSE)

## Links

- [OPNet](https://opnet.org)
- [Documentation](./docs/)
- [GitHub](https://github.com/btc-vision/btc-runtime)
- [npm](https://www.npmjs.com/package/@btc-vision/btc-runtime)
- [Verichains](https://verichains.io)
