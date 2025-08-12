# OPNet Smart Contract Runtime

![Bitcoin](https://img.shields.io/badge/Bitcoin-000?style=for-the-badge&logo=bitcoin&logoColor=white)
![AssemblyScript](https://img.shields.io/badge/assembly%20script-%23000000.svg?style=for-the-badge&logo=assemblyscript&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![NodeJS](https://img.shields.io/badge/Node%20js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![WebAssembly](https://img.shields.io/badge/WebAssembly-654FF0?style=for-the-badge&logo=webassembly&logoColor=white)
![NPM](https://img.shields.io/badge/npm-CB3837?style=for-the-badge&logo=npm&logoColor=white)

[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Core Concepts](#core-concepts)
    - [Blockchain Environment](#blockchain-environment)
    - [Contracts](#contracts)
    - [Events](#events)
    - [Pointers and Storage Management](#pointers-and-storage-management)
4. [Usage Examples](#usage-examples)
5. [Advanced Topics](#advanced-topics)
6. [Additional Documentation](#additional-documentation)
7. [License](#license)

## Introduction

The OPNet Smart Contract Runtime provides the foundational components required for creating smart contracts on Bitcoin
Layer 1 (L1). Written in AssemblyScript, this runtime allows developers to leverage WebAssembly for efficient contract
execution while integrating deeply with Bitcoin's decentralized architecture.

### Features

- **AssemblyScript and WebAssembly:** Efficient and high-performance contract execution using WebAssembly.
- **Bitcoin Integration:** Direct interaction with Bitcoin L1, enabling the creation of decentralized applications that
  operate on the Bitcoin network.
- **Comprehensive Storage Management:** Flexible and secure storage management using primary pointers and sub-pointers,
  ensuring data integrity through cryptographic proofs.
- **Event Handling:** Sophisticated event system for contract state changes, allowing easy tracking and logging of
  contract activities.

## Installation

1. Clone the repository:
    ```bash
    git clone https://github.com/btc-vision/btc-runtime.git
    ```
2. Navigate to the repository directory:
    ```bash
    cd btc-runtime
    ```
3. Install the necessary dependencies:
    ```bash
    npm install
    ```

## Core Concepts

### Blockchain Environment

The `Blockchain` object environment is the backbone of the OPNet runtime, providing essential functionality for
interacting with the blockchain, such as managing contract states, handling transactions, and emitting events.

For more detailed information, see the [Blockchain.md](docs/Blockchain.md) documentation.

### Contracts

Contracts in OPNet are AssemblyScript classes that extend the `OP_NET` base class. The constructor pattern differs from
Solidity's, as it runs every time a contract is instantiated, so developers should not use the constructor for
persistent initialization.

For a detailed guide on how to structure contracts, refer to the [Contract.md](docs/Contract.md) documentation.

### Events

Events in OPNet allow contracts to emit signals that external observers can listen to. They are crucial for tracking
state changes and interactions within the contract.

For a comprehensive explanation on how to define and use events, refer to the [Events.md](docs/Events.md) documentation.

### Pointers and Storage Management

Storage in OPNet is managed using a combination of pointers (`u16`) and sub-pointers (`u256`). These are encoded and
hashed to generate unique storage locations that are secure and verifiable. This approach ensures that the data stored
is tamper-proof and can be efficiently accessed.

For more details on pointers and storage management, see the [Pointers.md](docs/Pointers.md)
and [Storage.md](docs/Storage.md) documentation.

## Usage Examples

### Creating a Basic Token Contract

Here is a real-world example of how to create a basic token contract using the OPNet Smart Contract Runtime. This
contract follows the OP20 standard.

```typescript
import { u256 } from '@btc-vision/as-bignum/assembly';
import {
    Address,
    AddressMap,
    Blockchain,
    BytesWriter,
    Calldata,
    OP20,
    OP20InitParameters,
    SafeMath,
} from '@btc-vision/btc-runtime/runtime';

@final
export class MyToken extends OP20 {
    public constructor() {
        super();

        // IMPORTANT. THIS WILL RUN EVERYTIME THE CONTRACT IS INTERACTED WITH. FOR SPECIFIC INITIALIZATION, USE "onDeployment" METHOD.
    }

    // "solidityLikeConstructor" This is a solidity-like constructor. This method will only run once when the contract is deployed.
    public override onDeployment(_calldata: Calldata): void {
        const maxSupply: u256 = u256.fromString('1000000000000000000000000000'); // Your max supply. (Here, 1 billion tokens)
        const decimals: u8 = 18; // Your decimals.
        const name: string = 'Test'; // Your token name.
        const symbol: string = 'TEST'; // Your token symbol.

        this.instantiate(new OP20InitParameters(maxSupply, decimals, name, symbol));

        // Add your logic here. Eg, minting the initial supply:
        // this._mint(Blockchain.tx.origin, maxSupply);
    }

    @method(
        {
            name: 'address',
            type: ABIDataTypes.ADDRESS,
        },
        {
            name: 'amount',
            type: ABIDataTypes.UINT256,
        },
    )
    @emit('Minted')
    public mint(calldata: Calldata): BytesWriter {
        this.onlyDeployer(Blockchain.tx.sender);
        this._mint(calldata.readAddress(), calldata.readU256());
        return new BytesWriter(0);
    }

    /**
     * Mints tokens to the specified addresses.
     *
     * @param calldata Calldata containing an `AddressMap<Address, u256>` to mint to.
     */
    @method({
        name: 'addressAndAmount',
        type: ABIDataTypes.ADDRESS_UINT256_TUPLE,
    })
    @emit('Minted')
    public airdrop(calldata: Calldata): BytesWriter {
        this.onlyDeployer(Blockchain.tx.sender);

        const addressAndAmount: AddressMap<u256> = calldata.readAddressMapU256();
        const addresses: Address[] = addressAndAmount.keys();

        let totalAirdropped: u256 = u256.Zero;

        for (let i: i32 = 0; i < addresses.length; i++) {
            const address = addresses[i];
            const amount = addressAndAmount.get(address);

            const currentBalance: u256 = this.balanceOfMap.get(address);

            if (currentBalance) {
                this.balanceOfMap.set(address, SafeMath.add(currentBalance, amount));
            } else {
                this.balanceOfMap.set(address, amount);
            }

            totalAirdropped = SafeMath.add(totalAirdropped, amount);

            this.createMintedEvent(address, amount);
        }

        this._totalSupply.set(SafeMath.add(this._totalSupply.value, totalAirdropped));

        return new BytesWriter(0);
    }
}
```

## Advanced Topics

### Storage Management with Cryptographic Proofs

Storage pointers and sub-pointers are encoded and hashed to create unique and secure storage locations. These storage
locations are managed using the `Blockchain` class's `setStorageAt` and `getStorageAt` methods, ensuring data integrity
and preventing tampering.

## License

This project is licensed under the MIT License. View the full license [here](LICENSE.md).
