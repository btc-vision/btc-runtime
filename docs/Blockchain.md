### Blockchain Documentation

The `Blockchain` object is essential for executing smart contracts within the OP_NET runtime. It provides the
necessary context, such as the transaction origin, sender, block details, and contract-specific information. This
documentation covers the public properties and selected methods of the class, explaining their purpose and providing
usage examples.

---

#### Public Properties

1. **origin**
    - **Type**: `Address`
    - **Description**: The address of the transaction origin, which is the initial sender of the transaction. It is
      crucial for identifying who initiated the transaction. If the origin is not set, accessing this property will
      throw an error.
    - **Usage Example**:
      ```typescript
      let txOrigin: Address = Blockchain.origin;
      Blockchain.log(`Transaction Origin: ${txOrigin}`);
      ```

2. **sender**
    - **Type**: `Address`
    - **Description**: The address of the immediate caller (sender) of the transaction. This property is used to
      identify the entity that directly invoked the current contract. If the sender is not set, accessing this property
      will throw an error.
    - **Usage Example**:
      ```typescript
      let txSender: Address = Blockchain.sender;
      Blockchain.log(`Transaction Sender: ${txSender}`);
      ```

3. **timestamp**
    - **Type**: `u64`
    - **Description**: The timestamp at which the current block was mined. This property allows contracts to access and
      utilize the time associated with the block, which can be useful for time-dependent logic.
    - **Usage Example**:
      ```typescript
      let blockTimestamp: u64 = Blockchain.timestamp;
      Blockchain.log(`Block Timestamp: ${blockTimestamp}`);
      ```

4. **contract**
    - **Type**: `OP_NET`
    - **Description**: The instance of the contract being executed. This property provides access to the current
      contract's functionality and state. If the contract is not set, accessing this property will throw an error.
    - **Usage Example**:
      ```typescript
      let currentContract: OP_NET = Blockchain.contract;
      ```

    - **Setter**:
      ```typescript
      Blockchain.contract = () => myContractInstance;
      ```

5. **nextPointer**
    - **Type**: `u16`
    - **Description**: Returns the next available storage pointer, incrementing it each time it is accessed. This
      property is used to manage storage slots dynamically within the contract. If the maximum pointer limit is reached,
      it will throw an error.
    - **Usage Example**:
      ```typescript
      let pointer: u16 = Blockchain.nextPointer;
      Blockchain.log(`Next Pointer: ${pointer}`);
      ```

6. **owner**
    - **Type**: `Address`
    - **Description**: The address of the contract's owner. This property is crucial for identifying and verifying the
      contract's ownership. If the owner is not set, accessing this property will throw an error.
    - **Usage Example**:
      ```typescript
      let contractOwner: Address = Blockchain.owner;
      Blockchain.log(`Contract Owner: ${contractOwner}`);
      ```

7. **contractAddress**
    - **Type**: `Address`
    - **Description**: The address at which the current contract is deployed. This property is essential for operations
      that involve contract interactions or referencing the contract's address within its logic. If the contract address
      is not set, accessing this property will throw an error.
    - **Usage Example**:
      ```typescript
      let deployedAddress: Address = Blockchain.contractAddress;
      Blockchain.log(`Deployed Contract Address: ${deployedAddress}`);
      ```

8. **blockNumber**
    - **Type**: `u256`
    - **Description**: The current block number as a 256-bit unsigned integer. This property is used to reference the
      block in which the contract is executing.
    - **Usage Example**:
      ```typescript
      let currentBlockNum: u256 = Blockchain.blockNumber;
      Blockchain.log(`Current Block Number: ${currentBlockNum.toU64()}`);
      ```

9. **blockNumberU64**
    - **Type**: `u64`
    - **Description**: The current block number as a 64-bit unsigned integer. This property provides a more compact
      representation of the block number when the full 256-bit width is not needed.
    - **Usage Example**:
      ```typescript
      let blockNum: u64 = Blockchain.blockNumberU64;
      Blockchain.log(`Block Number (U64): ${blockNum}`);
      ```

---

#### Public Methods

1. **call(destinationContract: Address, calldata: BytesWriter)**
    - **Returns**: `BytesReader`
    - **Description**: Executes a contract call to the specified destination contract with the provided calldata. This
      method allows one contract to interact with another by sending a message or calling a function. The destination
      contract cannot be the origin (self-call is prohibited), ensuring that contracts do not call themselves
      recursively.
    - **Usage Example**:
      ```typescript
      let destination: Address = ...; // Address of the destination contract
      let calldata = new BytesWriter();
      calldata.writeString('someFunction');
      let response = Blockchain.call(destination, calldata);
      Blockchain.log(`Response: ${response}`);
      ```

2. **log(data: string)**
    - **Description**: Logs the provided string data within the contract environment. This method is useful for
      debugging or tracking the execution flow within a contract.
    - **Usage Example**:
      ```typescript
      Blockchain.log('Contract execution started.');
      ```

3. **addEvent(event: NetEvent)**
    - **Description**: Adds a new event to the list of events emitted during the current transaction. This method
      enables contracts to emit events that can be observed by external entities (e.g., users or other contracts).
    - **Usage Example**:
      ```typescript
      let newEvent: NetEvent = ...; // Create an event
      Blockchain.addEvent(newEvent);
      ```

4. **encodeVirtualAddress(virtualAddress: Uint8Array)**
    - **Returns**: `Address`
    - **Description**: Encodes a virtual address into a proper `Address` type. This method is useful when dealing with
      addresses in their raw or virtual form and needing them in a standard format.
    - **Usage Example**:
      ```typescript
      let virtualAddr: Uint8Array = ...; // Some virtual address data
      let encodedAddr: Address = Blockchain.encodeVirtualAddress(virtualAddr);
      Blockchain.log(`Encoded Address: ${encodedAddr}`);
      ```

5. **deployContract(hash: u256, bytecode: Uint8Array)**
    - **Returns**: `DeployContractResponse`
    - **Description**: Deploys a new contract using the given hash and bytecode, returning a response that includes the
      virtual address and contract address. **Note: This method is not yet implemented.**
    - **Usage Example**:
      ```typescript
      let contractHash = u256.fromString('someHash');
      let contractBytecode: Uint8Array = ...; // Bytecode of the contract
      let deployResponse = Blockchain.deployContract(contractHash, contractBytecode);
      Blockchain.log(`Deployed Contract Address: ${deployResponse.contractAddress}`);
      ```

6. **deployContractFromExisting(existingAddress: Address, salt: u256)**
    - **Returns**: `DeployContractResponse`
    - **Description**: Deploys a new contract based on an existing contract address and a salt value, allowing for
      predictable address generation and contract replication.
    - **Usage Example**:
      ```typescript
      let existingAddr: Address = ...; // Existing contract address
      let salt = u256.fromString('someSalt');
      let deployResponse = Blockchain.deployContractFromExisting(existingAddr, salt);
      Blockchain.log(`New Contract Address: ${deployResponse.contractAddress}`);
      ```

7. **getStorageAt(pointer: u16, subPointer: MemorySlotPointer, defaultValue: MemorySlotData<u256>)**
    - **Returns**: `MemorySlotData<u256>`
    - **Description**: Retrieves the value stored at the specified storage pointer and sub-pointer. This method is
      crucial for accessing persistent data within the contract's storage.
    - **Usage Example**:
      ```typescript
      let value = Blockchain.getStorageAt(pointer, subPointer, u256.Zero);
      Blockchain.log(`Stored Value: ${value}`);
      ```

8. **hasStorageAt(pointer: u16, subPointer: MemorySlotPointer)**
    - **Returns**: `bool`
    - **Description**: Checks whether a value exists at the specified storage pointer and sub-pointer. This method helps
      determine if a storage location is occupied or has been set.
    - **Usage Example**:
      ```typescript
      let exists: bool = Blockchain.hasStorageAt(pointer, subPointer);
      Blockchain.log(`Storage Exists: ${exists}`);
      ```

9. **setStorageAt(pointer: u16, keyPointer: MemorySlotPointer, value: MemorySlotData<u256>)**
    - **Description**: Sets a value at the specified storage pointer and key pointer. This method is used to store
      persistent data in the contract's storage.
    - **Usage Example**:
      ```typescript
      Blockchain.setStorageAt(pointer, keyPointer, new MemorySlotData<u256>(u256.fromU32(1000)));
      ```

---

This documentation provides an overview of the `BlockchainEnvironment` class, explaining the purpose and usage of its
public properties and selected methods. Each method and property is accompanied by a usage example to help you integrate
this class into your OP_NET contracts effectively.

**Note:** The `deployContract` method is currently not implemented.
