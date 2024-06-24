# Wrapped Bitcoin (WBTC)

![Bitcoin](https://img.shields.io/badge/Bitcoin-000?style=for-the-badge&logo=bitcoin&logoColor=white)
![AssemblyScript](https://img.shields.io/badge/assembly%20script-%23000000.svg?style=for-the-badge&logo=assemblyscript&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![NodeJS](https://img.shields.io/badge/Node%20js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![WebAssembly](https://img.shields.io/badge/WebAssembly-654FF0?style=for-the-badge&logo=webassembly&logoColor=white)
![NPM](https://img.shields.io/badge/npm-CB3837?style=for-the-badge&logo=npm&logoColor=white)

[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

## Introduction

This repository contains the source code and documentation for the WBTC contract, which facilitates the wrapping and
unwrapping of Bitcoin, staking for rewards, and leveraging WBTC for decentralized finance (DeFi) activities.

## What is WBTC?

Wrapped Bitcoin (WBTC) is a tokenized version of Bitcoin (BTC) on Bitcoin. WBTC is pegged 1:1 with Bitcoin, providing
users the ability to use BTC in a tokenized form for smart contracts, staking, and other DeFi applications.

## What is OP_20?

OP_20 is the standard for executing smart contracts on Bitcoin using WebAssembly (WASM) and AssemblyScript or any other
language of your choice. This standard ensures deterministic contract execution, making it possible to create secure and
efficient decentralized applications (dApps) on Bitcoin Layer 1.

## Repository Contents

- **src/**: Source code of the WBTC contract, including core functionality and integration modules.
- **contract/**: Smart contracts for WBTC wrapping, unwrapping, and staking.

## Features

- **Wrapping and Unwrapping**: Convert Bitcoin to WBTC and vice versa seamlessly.
- **Staking**: Stake WBTC to earn rewards.

### Staking

Learn more about staking [here](https://github.com/btc-vision/wbtc/blob/main/STAKING.md).

## Getting Started

### Prerequisites

- Node.js version 14 or higher
- npm or Yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/btc-vision/wbtc.git
   ```
2. Navigate to the repository directory:
   ```bash
   cd wbtc
   ```
3. Install the necessary dependencies:
   ```bash
   npm i
   ```

## Building the Contract

To build the WBTC smart contract, use the following command:

```bash
npm run asbuild:release
```

This command compiles the AssemblyScript code into WebAssembly, generating the contract binary in the `build/`
directory.

## License

View the license by clicking [here](https://github.com/btc-vision/wbtc/blob/main/LICENSE.md).
