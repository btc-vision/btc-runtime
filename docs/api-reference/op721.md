# OP721 API Reference

The `OP721` class implements the non-fungible token (NFT) standard, equivalent to ERC721 on Ethereum.

## Import

```typescript
import { OP721, OP721InitParameters } from '@btc-vision/btc-runtime/runtime';
```

## OP721 Architecture

```mermaid
classDiagram
    class OP721 {
        <<abstract>>
        +_name: StoredString
        +_symbol: StoredString
        +_baseURI: StoredString
        +_totalSupply: StoredU256
        +_maxSupply: StoredU256
        +ownerOfMap: StoredMapU256
        +balanceOfMap: AddressMemoryMap
        +tokenApprovalMap: StoredMapU256
        +operatorApprovalMap: MapOfMap~u256~
        +instantiate(params) void
        +ownerOf(tokenId) Address
        +balanceOf(owner) u256
        +approve(operator, tokenId) void
        +safeTransfer(to, tokenId, data) void
        +safeTransferFrom(from, to, tokenId, data) void
        #_mint(to, tokenId) void
        #_burn(tokenId) void
        #_transfer(from, to, tokenId, data) void
    }

    class ReentrancyGuard {
        <<abstract>>
        #reentrancyLevel: ReentrancyLevel
    }

    class OP_NET {
        <<abstract>>
        +address: Address
        #emitEvent(event) void
        Note: @method decorator handles routing
    }

    class MyNFT {
        +_nextTokenId: StoredU256
        +_baseURI: StoredString
        +constructor()
        +onDeployment(calldata) void
        +mint(calldata) BytesWriter
        +tokenURI(tokenId) string
        Note: @method decorator handles routing
    }

    OP_NET <|-- ReentrancyGuard
    ReentrancyGuard <|-- OP721
    OP721 <|-- MyNFT

    note for OP721 "NFT standard with\nenumeration support\nand approval management"
    note for MyNFT "Your NFT collection\nextends OP721"
```

## Class Definition

```typescript
@final
export class MyNFT extends OP721 {
    public constructor() {
        super();
    }

    public override onDeployment(calldata: Calldata): void {
        const name = calldata.readString();
        const symbol = calldata.readString();
        const baseURI = calldata.readString();
        const maxSupply = calldata.readU256();

        this.instantiate(new OP721InitParameters(
            name,
            symbol,
            baseURI,
            maxSupply
        ));
    }
}
```

## Initialization

### OP721InitParameters

```typescript
class OP721InitParameters {
    constructor(
        name: string,
        symbol: string,
        baseURI: string,
        maxSupply: u256,
        collectionBanner: string = '',
        collectionIcon: string = '',
        collectionWebsite: string = '',
        collectionDescription: string = ''
    )
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Collection name |
| `symbol` | `string` | Yes | Collection symbol |
| `baseURI` | `string` | Yes | Base URI for token metadata |
| `maxSupply` | `u256` | Yes | Maximum number of tokens that can be minted |
| `collectionBanner` | `string` | No | Collection banner URL (default: '') |
| `collectionIcon` | `string` | No | Collection icon URL (default: '') |
| `collectionWebsite` | `string` | No | Collection website URL (default: '') |
| `collectionDescription` | `string` | No | Collection description (default: '') |

### instantiate

Initializes the OP721 NFT. Must be called in `onDeployment`.

```typescript
public instantiate(
    params: OP721InitParameters,
    skipDeployerVerification: boolean = false
): void
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `params` | `OP721InitParameters` | Initialization parameters |
| `skipDeployerVerification` | `boolean` | Skip deployer check (default: false) |

**Solidity Comparison:**
| Solidity (ERC721) | OPNet (OP721) |
|-------------------|---------------|
| `constructor(string name, string symbol)` | `onDeployment(calldata)` + `instantiate()` |

## View Methods

### name

Returns the collection name.

```typescript
public name(): string
```

### symbol

Returns the collection symbol.

```typescript
public symbol(): string
```

### totalSupply

Returns total minted tokens.

```typescript
public get totalSupply(): u256
```

### maxSupply

Returns maximum supply limit.

```typescript
public get maxSupply(): u256
```

### balanceOf

Returns number of tokens owned by address.

```typescript
public balanceOf(owner: Address): u256
```

### ownerOf

Returns owner of a token.

```typescript
public ownerOf(tokenId: u256): Address
```

### tokenURI

Returns metadata URI for a token.

```typescript
public tokenURI(tokenId: u256): string
```

Override to customize metadata:

```typescript
public override tokenURI(tokenId: u256): string {
    return this._baseURI.value + tokenId.toString() + '.json';
}
```

### getApproved

Returns approved address for a token.

```typescript
public getApproved(tokenId: u256): Address
```

### isApprovedForAll

Checks if operator is approved for all tokens.

```typescript
public isApprovedForAll(owner: Address, operator: Address): bool
```

**Solidity Comparison:**
| Solidity (ERC721) | OPNet (OP721) |
|-------------------|---------------|
| `function ownerOf(uint256) view returns (address)` | `ownerOf(u256): Address` |
| `function balanceOf(address) view returns (uint256)` | `balanceOf(Address): u256` |
| `function tokenURI(uint256) view returns (string)` | `tokenURI(u256): string` |

## Transfer Methods

### safeTransfer (Calldata)

Transfers an NFT from the sender to a recipient.

```typescript
public safeTransfer(calldata: Calldata): BytesWriter
```

**Calldata format:**
| Field | Type | Size |
|-------|------|------|
| to | Address | 32 bytes |
| tokenId | u256 | 32 bytes |
| data | bytes | variable (length-prefixed) |

The following diagram shows the complete NFT transfer validation and execution flow:

```mermaid
flowchart LR
    subgraph "Validation"
        Start([NFT Transfer]) --> CheckOwner{Verify owner}
        CheckOwner -->|Invalid| Revert1[Revert: Wrong owner]
        CheckOwner -->|Valid| CheckTo{to != zero?}
        CheckTo -->|to == zero| Revert2[Revert: Invalid recipient]
        CheckTo -->|Valid| CheckAuth{Authorization}
    end

    subgraph "Authorization"
        CheckAuth -->|Not authorized| Revert3[Revert: Not authorized]
        CheckAuth -->|Owner| DoTransfer[Execute transfer]
        CheckAuth -->|Approved operator| DoTransfer
        CheckAuth -->|Token approved| DoTransfer
    end

    subgraph "Transfer Execution"
        DoTransfer --> ClearApproval[Clear approval]
        ClearApproval --> UpdateEnum[Update enumerations]
        UpdateEnum --> UpdateBal[Update balances]
        UpdateBal --> UpdateOwner[Set new owner]
        UpdateOwner --> EmitEvent[Emit TransferEvent]
    end

    subgraph "Callback Handling"
        EmitEvent --> IsContract{Recipient<br/>is contract?}
        IsContract -->|No| Success([Complete])
        IsContract -->|Yes| Callback[Call onOP721Received]
        Callback --> CheckResponse{Valid<br/>response?}
        CheckResponse -->|Yes| Success
        CheckResponse -->|No| Revert4[Revert: Rejected]
    end
```

### safeTransferFrom (Calldata)

Safe transfer with recipient callback.

```typescript
public safeTransferFrom(calldata: Calldata): BytesWriter
```

**Calldata format:**
| Field | Type | Size |
|-------|------|------|
| from | Address | 32 bytes |
| to | Address | 32 bytes |
| tokenId | u256 | 32 bytes |
| data | bytes | variable (length-prefixed) |

Calls `onOP721Received` on recipient if it's a contract.

### burn (Calldata)

Burns a token. Only owner or approved addresses can burn.

```typescript
public burn(calldata: Calldata): BytesWriter
```

**Calldata format:**
| Field | Type | Size |
|-------|------|------|
| tokenId | u256 | 32 bytes |

The following sequence diagram illustrates the complete mint and transfer flow:

```mermaid
sequenceDiagram
    participant Owner
    participant NFT as OP721 Contract
    participant Maps as Storage Maps
    participant Recipient

    Note over Owner,Recipient: Mint Flow

    Owner->>NFT: _mint(to, tokenId)
    NFT->>NFT: Check tokenId doesn't exist
    NFT->>NFT: Check max supply not reached

    NFT->>Maps: ownerOfMap.set(tokenId, to)
    NFT->>Maps: balanceOfMap[to] += 1
    NFT->>Maps: Add to owner enumeration
    NFT->>NFT: totalSupply += 1

    NFT->>NFT: Emit TransferEvent(zero, to, tokenId)

    Note over Owner,Recipient: Transfer Flow

    Owner->>NFT: approve(operator, tokenId)
    NFT->>NFT: Check caller is owner or approved for all
    NFT->>Maps: tokenApprovalMap.set(tokenId, operator)
    NFT->>NFT: Emit ApprovalEvent

    Recipient->>NFT: safeTransferFrom(owner, recipient, tokenId, data)
    NFT->>NFT: Check authorization
    NFT->>NFT: _transfer(owner, recipient, tokenId, data)

    NFT->>Maps: Clear token approval
    NFT->>Maps: Remove from old owner enumeration
    NFT->>Maps: Add to new owner enumeration
    NFT->>Maps: balanceOfMap[owner] -= 1
    NFT->>Maps: balanceOfMap[recipient] += 1
    NFT->>Maps: ownerOfMap.set(tokenId, recipient)

    NFT->>NFT: Emit TransferEvent

    alt Recipient is Contract
        NFT->>Recipient: call onOP721Received
        Recipient->>NFT: Return selector
        NFT->>NFT: Verify response
    end

    NFT->>Recipient: Success
```

**Solidity Comparison:**
| Solidity (ERC721) | OPNet (OP721) |
|-------------------|---------------|
| `function transferFrom(address, address, uint256)` | `safeTransferFrom(calldata): BytesWriter` |
| `function safeTransferFrom(address, address, uint256, bytes)` | `safeTransferFrom(calldata): BytesWriter` |
| N/A | `safeTransfer(calldata): BytesWriter` (from sender) |

## Approval Methods

### approve (Calldata)

Approves an address for a single token.

```typescript
public approve(calldata: Calldata): BytesWriter
```

**Calldata format:**
| Field | Type | Size |
|-------|------|------|
| operator | Address | 32 bytes |
| tokenId | u256 | 32 bytes |

### setApprovalForAll (Calldata)

Sets operator approval for all tokens.

```typescript
public setApprovalForAll(calldata: Calldata): BytesWriter
```

**Calldata format:**
| Field | Type | Size |
|-------|------|------|
| operator | Address | 32 bytes |
| approved | bool | 1 byte |

**Solidity Comparison:**
| Solidity (ERC721) | OPNet (OP721) |
|-------------------|---------------|
| `function approve(address, uint256)` | `approve(calldata): BytesWriter` |
| `function setApprovalForAll(address, bool)` | `setApprovalForAll(calldata): BytesWriter` |

## Protected Methods

### _mint

Mints a new token.

```typescript
protected _mint(to: Address, tokenId: u256): void
```

```typescript
@method(
    { name: 'to', type: ABIDataTypes.ADDRESS },
    { name: 'tokenId', type: ABIDataTypes.UINT256 },
)
@returns({ name: 'success', type: ABIDataTypes.BOOL })
@emit('Transfer')
public mint(calldata: Calldata): BytesWriter {
    this.onlyDeployer(Blockchain.tx.sender);
    const to: Address = calldata.readAddress();
    const tokenId: u256 = calldata.readU256();
    this._mint(to, tokenId);
    return new BytesWriter(0);
}
```

### _burn

Burns a token.

```typescript
protected _burn(tokenId: u256): void
```

### _transfer

Internal transfer with data for safe transfer callbacks.

```typescript
protected _transfer(from: Address, to: Address, tokenId: u256, data: Uint8Array): void
```

### _approve

Internal approval.

```typescript
protected _approve(operator: Address, tokenId: u256): void
```

### _setApprovalForAll

Internal operator approval.

```typescript
protected _setApprovalForAll(owner: Address, operator: Address, approved: bool): void
```

### _setTokenURI

Sets a custom URI for a specific token.

```typescript
protected _setTokenURI(tokenId: u256, uri: string): void
```

### _setBaseURI

Sets the base URI for all tokens.

```typescript
protected _setBaseURI(baseURI: string): void
```

### _exists

Checks if a token exists.

```typescript
protected _exists(tokenId: u256): bool
```

### _ownerOf

Returns the owner of a token. Throws if token doesn't exist.

```typescript
protected _ownerOf(tokenId: u256): Address
```

### _balanceOf

Returns the balance of an address. Throws if zero address.

```typescript
protected _balanceOf(owner: Address): u256
```

### _isApprovedForAll

Checks if an operator is approved for all tokens.

```typescript
protected _isApprovedForAll(owner: Address, operator: Address): boolean
```

**Solidity Comparison:**
| Solidity (ERC721) | OPNet (OP721) |
|-------------------|---------------|
| `function _mint(address, uint256) internal` | `_mint(Address, u256): void` |
| `function _burn(uint256) internal` | `_burn(u256): void` |
| `function _safeMint(address, uint256)` | `_mint()` (automatically checks recipient) |

## Enumeration System

### tokenOfOwnerByIndex

Returns token ID at index for owner.

```typescript
public tokenOfOwnerByIndex(owner: Address, index: u256): u256
```

The enumeration system allows efficient iteration over tokens owned by an address:

```mermaid
graph LR
    A[NFT Collection]

    subgraph "Owner Enumeration"
        B[ownerTokensMap<br/>Address -> StoredU256Array]
        C[Owner's Token Array]
        D[Token IDs owned<br/>by address]
        B --> C
        C --> D
    end

    subgraph "Index Tracking"
        E[tokenIndexMap<br/>tokenId -> u256]
        F[Index in owner's array]
        E --> F
    end

    subgraph "Add Token Operations"
        G[_addTokenToOwnerEnumeration<br/>On mint/transfer in]
        H[Push tokenId to array]
        I[Set tokenIndexMap]
        G --> H --> I
    end

    subgraph "Remove Token Operations"
        J[_removeTokenFromOwnerEnumeration<br/>On burn/transfer out]
        K[Get last token in array]
        L[Move last to removed position]
        M[Delete last element]
        N[Update tokenIndexMap]
        J --> K --> L --> M --> N
    end

    A --> B
    A --> E
    G -.->|modifies| C
    J -.->|modifies| C
```

The following sequence diagram shows how enumeration queries work:

```mermaid
sequenceDiagram
    participant User as 👤 User
    participant NFT as OP721
    participant OwnerMap as ownerTokensMap
    participant IndexMap as tokenIndexMap

    Note over User,IndexMap: Query Owner's Tokens

    User->>NFT: balanceOf(owner)
    NFT->>NFT: Return balance (e.g., 5 tokens)

    User->>NFT: tokenOfOwnerByIndex(owner, 0)
    NFT->>OwnerMap: Get owner's token array
    OwnerMap->>NFT: Return StoredU256Array
    NFT->>NFT: array.get(0)
    NFT->>User: Return tokenId (e.g., 42)

    User->>NFT: tokenOfOwnerByIndex(owner, 1)
    NFT->>NFT: array.get(1)
    NFT->>User: Return tokenId (e.g., 137)

    Note over User,IndexMap: Iterate All Tokens

    loop For each index from 0 to balance-1
        User->>NFT: tokenOfOwnerByIndex(owner, index)
        NFT->>User: Return tokenId
    end

    Note over User,IndexMap: Internal: Add Token to Enumeration

    NFT->>NFT: _addTokenToOwnerEnumeration(owner, tokenId)
    NFT->>OwnerMap: Get owner's array
    NFT->>NFT: newIndex = array.length
    NFT->>OwnerMap: array.push(tokenId)
    NFT->>IndexMap: tokenIndexMap.set(tokenId, newIndex)

    Note over User,IndexMap: Internal: Remove Token from Enumeration

    NFT->>NFT: _removeTokenFromOwnerEnumeration(owner, tokenId)
    NFT->>IndexMap: Get tokenIndex for tokenId
    NFT->>OwnerMap: Get last token in array
    NFT->>OwnerMap: Move last token to removed position
    NFT->>IndexMap: Update index for moved token
    NFT->>OwnerMap: Delete last element
    NFT->>IndexMap: Delete tokenId mapping
```

```typescript
// Get all tokens owned by address
const balance = this.balanceOf(owner);
for (let i = u256.Zero; i < balance; i = SafeMath.add(i, u256.One)) {
    const tokenId = this.tokenOfOwnerByIndex(owner, i);
    // Process tokenId
}
```

**Note:** Unlike ERC721Enumerable, OP721 does not include a global `tokenByIndex` method. It only provides `tokenOfOwnerByIndex` for per-owner enumeration.

## Events

### TransferredEvent

Emitted on transfers, mints, and burns.

```typescript
class TransferredEvent extends NetEvent {
    constructor(
        operator: Address,  // The address that initiated the transfer (Blockchain.tx.sender)
        from: Address,      // Previous owner (Address.zero() for mint)
        to: Address,        // New owner (Address.zero() for burn)
        tokenId: u256       // The token being transferred
    )
}
```

### ApprovedEvent

Emitted on token approvals.

```typescript
class ApprovedEvent extends NetEvent {
    constructor(
        owner: Address,    // Token owner
        spender: Address,  // Approved address
        tokenId: u256      // The token being approved
    )
}
```

### ApprovedForAllEvent

Emitted on operator approvals.

```typescript
class ApprovedForAllEvent extends NetEvent {
    constructor(
        owner: Address,     // Token owner
        operator: Address,  // Operator address
        approved: bool      // Approval status
    )
}
```

### URIEvent

Emitted when a token URI is set or changed.

```typescript
class URIEvent extends NetEvent {
    constructor(
        value: string,  // The new URI
        id: u256        // The token ID
    )
}
```

**Solidity Comparison:**
| Solidity (ERC721) | OPNet (OP721) |
|-------------------|---------------|
| `event Transfer(address indexed, address indexed, uint256 indexed)` | `TransferredEvent(operator, from, to, tokenId)` |
| `event Approval(address indexed, address indexed, uint256 indexed)` | `ApprovedEvent(owner, spender, tokenId)` |
| `emit Transfer(from, to, tokenId)` | `emitEvent(new TransferredEvent(sender, from, to, tokenId))` |

## Storage Layout

OP721 uses multiple storage pointers:

| Purpose | Description |
|---------|-------------|
| Token owners | Maps tokenId -> owner |
| Balances | Maps owner -> count |
| Approvals | Maps tokenId -> approved |
| Operator approvals | Maps owner+operator -> bool |
| Owned tokens | Maps owner+index -> tokenId |
| Owned token index | Maps tokenId -> index |
| All tokens | Maps index -> tokenId |
| All tokens index | Maps tokenId -> index |
| Name | Collection name |
| Symbol | Collection symbol |
| Total supply | Current count |

## Method Selectors

| Selector | Method |
|----------|--------|
| `name` | Returns name |
| `symbol` | Returns symbol |
| `totalSupply` | Returns total supply |
| `maxSupply` | Returns maximum supply |
| `balanceOf` | Returns balance |
| `ownerOf` | Returns owner |
| `tokenURI` | Returns metadata URI |
| `approve` | Approve address |
| `getApproved` | Get approved address |
| `setApprovalForAll` | Set operator approval |
| `isApprovedForAll` | Check operator approval |
| `safeTransfer` | Transfer from sender |
| `safeTransferFrom` | Safe transfer with from address |
| `burn` | Burn token |
| `tokenOfOwnerByIndex` | Enumerable: owner token at index |
| `collectionInfo` | Returns collection metadata |
| `metadata` | Returns full collection metadata |
| `domainSeparator` | Returns EIP-712 domain separator |
| `getApproveNonce` | Returns signature nonce for address |
| `approveBySignature` | Approve via EIP-712 signature |
| `setApprovalForAllBySignature` | Set operator approval via signature |
| `setBaseURI` | Update base URI (deployer only) |
| `changeMetadata` | Update collection metadata (deployer only) |

## Complete Example

```typescript
import { u256 } from '@btc-vision/as-bignum/assembly';
import {
    OP721,
    OP721InitParameters,
    Blockchain,
    Calldata,
    BytesWriter,
    SafeMath,
    Address,
    ABIDataTypes,
} from '@btc-vision/btc-runtime/runtime';

@final
export class MyNFT extends OP721 {
    public constructor() {
        super();
    }

    public override onDeployment(calldata: Calldata): void {
        const name = calldata.readStringWithLength();
        const symbol = calldata.readStringWithLength();
        const baseURI = calldata.readStringWithLength();
        const maxSupply = calldata.readU256();

        this.instantiate(new OP721InitParameters(
            name,
            symbol,
            baseURI,
            maxSupply
        ));
    }

    @method({ name: 'to', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'tokenId', type: ABIDataTypes.UINT256 })
    @emit('Transferred')
    public mint(calldata: Calldata): BytesWriter {
        this.onlyDeployer(Blockchain.tx.sender);

        const to: Address = calldata.readAddress();

        // Use internal _nextTokenId from OP721 base class
        const tokenId = this._nextTokenId.value;
        this._mint(to, tokenId);
        this._nextTokenId.value = SafeMath.add(tokenId, u256.One);

        const writer = new BytesWriter(32);
        writer.writeU256(tokenId);
        return writer;
    }
}
```

## Solidity Comparison Summary

| Solidity (ERC721) | OPNet (OP721) |
|-------------------|---------------|
| `constructor(name, symbol)` | `instantiate(new OP721InitParameters(name, symbol, baseURI, maxSupply, ...))` |
| `function ownerOf(uint256)` | `ownerOf(u256): Address` |
| `_mint(address, uint256)` | `_mint(Address, u256)` |
| `_safeMint(address, uint256)` | `_mint()` (automatically emits TransferredEvent) |
| `emit Transfer(...)` | `emitEvent(new TransferredEvent(operator, from, to, tokenId))` |
| `transferFrom(from, to, tokenId)` | `safeTransferFrom(from, to, tokenId, data)` |
| N/A | `safeTransfer(to, tokenId, data)` (from sender) |

---

**Navigation:**
- Previous: [OP20 API](./op20.md)
- Next: [SafeMath API](./safe-math.md)
