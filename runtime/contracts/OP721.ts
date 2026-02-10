// THIS STANDARD IS EXPERIMENTAL AND SHOULDN'T BE USED IN REAL PROJECTS
// CONTRACTS USING THIS COULD BREAK IN THE FUTURE

import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesWriter } from '../buffer/BytesWriter';
import { Blockchain } from '../env';
import { sha256 } from '../env/global';
import { EMPTY_POINTER } from '../math/bytes';
import { AddressMemoryMap } from '../memory/AddressMemoryMap';
import { MapOfMap } from '../memory/MapOfMap';
import { StoredString } from '../storage/StoredString';
import { StoredU256 } from '../storage/StoredU256';
import { StoredU256Array } from '../storage/arrays/StoredU256Array';
import { Calldata } from '../types';
import { Address } from '../types/Address';
import { Revert } from '../types/Revert';
import { SafeMath } from '../types/SafeMath';
import {
    ADDRESS_BYTE_LENGTH,
    BOOLEAN_BYTE_LENGTH,
    SELECTOR_BYTE_LENGTH,
    U256_BYTE_LENGTH,
    U32_BYTE_LENGTH,
    U64_BYTE_LENGTH,
    U8_BYTE_LENGTH,
} from '../utils';
import { IOP721 } from './interfaces/IOP721';
import { OP721InitParameters } from './interfaces/OP721InitParameters';
import { ReentrancyGuard } from './ReentrancyGuard';
import { StoredMapU256 } from '../storage/maps/StoredMapU256';
import {
    ApprovedEvent,
    ApprovedForAllEvent,
    MAX_URI_LENGTH,
    TransferredEvent,
    URIEvent,
} from '../events/predefined';
import {
    ON_OP721_RECEIVED_SELECTOR,
    OP712_DOMAIN_TYPE_HASH,
    OP712_VERSION_HASH,
    OP721_APPROVAL_FOR_ALL_TYPE_HASH,
    OP721_APPROVAL_TYPE_HASH,
} from '../constants/Exports';
import { ExtendedAddress } from '../types/ExtendedAddress';

const stringPointer: u16 = Blockchain.nextPointer;
const totalSupplyPointer: u16 = Blockchain.nextPointer;
const maxSupplyPointer: u16 = Blockchain.nextPointer;
const ownerOfMapPointer: u16 = Blockchain.nextPointer;
const tokenApprovalMapPointer: u16 = Blockchain.nextPointer;
const operatorApprovalMapPointer: u16 = Blockchain.nextPointer;
const balanceOfMapPointer: u16 = Blockchain.nextPointer;
const tokenURIMapPointer: u16 = Blockchain.nextPointer;
const nextTokenIdPointer: u16 = Blockchain.nextPointer;
const ownerTokensMapPointer: u16 = Blockchain.nextPointer;
const tokenIndexMapPointer: u16 = Blockchain.nextPointer;
const initializedPointer: u16 = Blockchain.nextPointer;
const tokenURICounterPointer: u16 = Blockchain.nextPointer;
const approveNonceMapPointer: u16 = Blockchain.nextPointer;

export abstract class OP721 extends ReentrancyGuard implements IOP721 {
    protected readonly _name: StoredString;
    protected readonly _symbol: StoredString;
    protected readonly _baseURI: StoredString;
    protected readonly _collectionBanner: StoredString;
    protected readonly _collectionIcon: StoredString;
    protected readonly _collectionDescription: StoredString;
    protected readonly _collectionWebsite: StoredString;

    protected readonly _totalSupply: StoredU256;
    protected readonly _maxSupply: StoredU256;
    protected readonly _nextTokenId: StoredU256;
    protected readonly _initialized: StoredU256;
    protected readonly _tokenURICounter: StoredU256;

    protected readonly ownerOfMap: StoredMapU256;
    protected readonly tokenApprovalMap: StoredMapU256;
    protected readonly balanceOfMap: AddressMemoryMap;
    protected readonly operatorApprovalMap: MapOfMap<u256>;

    protected readonly _approveNonceMap: AddressMemoryMap;

    // Token URI storage - stores index to StoredString array
    protected readonly tokenURIIndices: StoredMapU256;
    protected readonly tokenURIStorage: Map<u32, StoredString> = new Map();

    // Enumerable extension - owner -> array of token IDs
    protected readonly ownerTokensMap: Map<Address, StoredU256Array> = new Map();

    // Token ID -> index in owner's array
    protected readonly tokenIndexMap: StoredMapU256;

    public constructor() {
        super();

        this._name = new StoredString(stringPointer, 0);
        this._symbol = new StoredString(stringPointer, 2);
        this._baseURI = new StoredString(stringPointer, 3);
        this._collectionBanner = new StoredString(stringPointer, 4);
        this._collectionIcon = new StoredString(stringPointer, 5);
        this._collectionDescription = new StoredString(stringPointer, 6);
        this._collectionWebsite = new StoredString(stringPointer, 7);

        this._totalSupply = new StoredU256(totalSupplyPointer, EMPTY_POINTER);
        this._maxSupply = new StoredU256(maxSupplyPointer, EMPTY_POINTER);
        this._nextTokenId = new StoredU256(nextTokenIdPointer, EMPTY_POINTER);
        this._initialized = new StoredU256(initializedPointer, EMPTY_POINTER);
        this._tokenURICounter = new StoredU256(tokenURICounterPointer, EMPTY_POINTER);

        this.ownerOfMap = new StoredMapU256(ownerOfMapPointer);
        this.tokenApprovalMap = new StoredMapU256(tokenApprovalMapPointer);
        this.balanceOfMap = new AddressMemoryMap(balanceOfMapPointer);
        this.operatorApprovalMap = new MapOfMap<u256>(operatorApprovalMapPointer);

        // Initialize separate nonce maps
        this._approveNonceMap = new AddressMemoryMap(approveNonceMapPointer);

        this.tokenURIIndices = new StoredMapU256(tokenURIMapPointer);
        this.tokenIndexMap = new StoredMapU256(tokenIndexMapPointer);
    }

    public get name(): string {
        return this._name.value;
    }

    public get symbol(): string {
        return this._symbol.value;
    }

    public get baseURI(): string {
        return this._baseURI.value;
    }

    public get totalSupply(): u256 {
        return this._totalSupply.value;
    }

    public get maxSupply(): u256 {
        return this._maxSupply.value;
    }

    public get collectionBanner(): string {
        return this._collectionBanner.value;
    }

    public get collectionIcon(): string {
        return this._collectionIcon.value;
    }

    public get collectionDescription(): string {
        return this._collectionDescription.value;
    }

    public get collectionWebsite(): string {
        return this._collectionWebsite.value;
    }

    public instantiate(
        params: OP721InitParameters,
        skipDeployerVerification: boolean = false,
    ): void {
        if (!this._initialized.value.isZero()) throw new Revert('Already initialized');
        if (!skipDeployerVerification) this.onlyDeployer(Blockchain.tx.sender);

        if (params.name.length == 0) throw new Revert('Name cannot be empty');
        if (params.symbol.length == 0) throw new Revert('Symbol cannot be empty');
        if (params.maxSupply.isZero()) throw new Revert('Max supply cannot be zero');

        this._name.value = params.name;
        this._symbol.value = params.symbol;
        this._baseURI.value = params.baseURI;
        this._maxSupply.value = params.maxSupply;
        this._nextTokenId.value = u256.One;
        this._initialized.value = u256.One;
        this._tokenURICounter.value = u256.Zero;

        this._collectionBanner.value = params.collectionBanner;
        this._collectionIcon.value = params.collectionIcon;
        this._collectionDescription.value = params.collectionDescription;
        this._collectionWebsite.value = params.collectionWebsite;
    }

    @method('name')
    @returns({ name: 'name', type: ABIDataTypes.STRING })
    public fn_name(_: Calldata): BytesWriter {
        const name = this.name;
        const w = new BytesWriter(String.UTF8.byteLength(name) + 4);
        w.writeStringWithLength(name);
        return w;
    }

    @method('symbol')
    @returns({ name: 'symbol', type: ABIDataTypes.STRING })
    public fn_symbol(_: Calldata): BytesWriter {
        const symbol = this.symbol;
        const w = new BytesWriter(String.UTF8.byteLength(symbol) + 4);
        w.writeStringWithLength(symbol);
        return w;
    }

    @method('maxSupply')
    @returns({ name: 'maxSupply', type: ABIDataTypes.UINT256 })
    public fn_maxSupply(_: Calldata): BytesWriter {
        const w = new BytesWriter(U256_BYTE_LENGTH);
        w.writeU256(this.maxSupply);
        return w;
    }

    @method('collectionInfo')
    @returns(
        { name: 'icon', type: ABIDataTypes.STRING },
        { name: 'banner', type: ABIDataTypes.STRING },
        { name: 'description', type: ABIDataTypes.STRING },
        { name: 'website', type: ABIDataTypes.STRING },
    )
    public collectionInfo(_: Calldata): BytesWriter {
        const length =
            String.UTF8.byteLength(this.collectionIcon) +
            String.UTF8.byteLength(this.collectionDescription) +
            String.UTF8.byteLength(this.collectionWebsite) +
            String.UTF8.byteLength(this.collectionBanner);

        const w = new BytesWriter(U32_BYTE_LENGTH * 4 + length);
        w.writeStringWithLength(this.collectionIcon);
        w.writeStringWithLength(this.collectionBanner);
        w.writeStringWithLength(this.collectionDescription);
        w.writeStringWithLength(this.collectionWebsite);
        return w;
    }

    @method({ name: 'tokenId', type: ABIDataTypes.UINT256 })
    @returns({ name: 'uri', type: ABIDataTypes.STRING })
    public tokenURI(calldata: Calldata): BytesWriter {
        const tokenId = calldata.readU256();
        if (!this._exists(tokenId)) throw new Revert('Token does not exist');

        // Check if custom URI exists
        const uriIndex = this.tokenURIIndices.get(tokenId);
        let uri: string;

        if (!uriIndex.isZero()) {
            // Get custom URI from storage
            const index = uriIndex.toU32();
            if (!this.tokenURIStorage.has(index)) {
                // Lazy load from storage
                const storedURI = new StoredString(tokenURIMapPointer, index);
                this.tokenURIStorage.set(index, storedURI);
            }
            uri = this.tokenURIStorage.get(index).value;
        } else {
            // Return baseURI + tokenId
            uri = this.baseURI + tokenId.toString();
        }

        const w = new BytesWriter(String.UTF8.byteLength(uri) + 4);
        w.writeStringWithLength(uri);
        return w;
    }

    @method('changeMetadata')
    public changeMetadata(calldata: Calldata): BytesWriter {
        this.onlyDeployer(Blockchain.tx.sender);

        const icon: string = calldata.readStringWithLength();
        const banner: string = calldata.readStringWithLength();
        const description: string = calldata.readStringWithLength();
        const website: string = calldata.readStringWithLength();

        if (icon.length == 0) throw new Revert('Icon cannot be empty');
        if (banner.length == 0) throw new Revert('Banner cannot be empty');
        if (description.length == 0) throw new Revert('Description cannot be empty');
        if (website.length == 0) throw new Revert('Website cannot be empty');

        this._collectionIcon.value = icon;
        this._collectionBanner.value = banner;
        this._collectionDescription.value = description;
        this._collectionWebsite.value = website;

        return new BytesWriter(0);
    }

    @method('totalSupply')
    @returns({ name: 'totalSupply', type: ABIDataTypes.UINT256 })
    public fn_totalSupply(_: Calldata): BytesWriter {
        const w = new BytesWriter(U256_BYTE_LENGTH);
        w.writeU256(this.totalSupply);
        return w;
    }

    @method({ name: 'owner', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'balance', type: ABIDataTypes.UINT256 })
    public balanceOf(calldata: Calldata): BytesWriter {
        const owner = calldata.readAddress();
        const balance = this._balanceOf(owner);
        const w = new BytesWriter(U256_BYTE_LENGTH);
        w.writeU256(balance);
        return w;
    }

    @method({ name: 'tokenId', type: ABIDataTypes.UINT256 })
    @returns({ name: 'owner', type: ABIDataTypes.ADDRESS })
    public ownerOf(calldata: Calldata): BytesWriter {
        const tokenId = calldata.readU256();
        const owner = this._ownerOf(tokenId);
        const w = new BytesWriter(ADDRESS_BYTE_LENGTH);
        w.writeAddress(owner);
        return w;
    }

    @method(
        { name: 'to', type: ABIDataTypes.ADDRESS },
        { name: 'tokenId', type: ABIDataTypes.UINT256 },
    )
    @emit('Transferred')
    public transfer(calldata: Calldata): BytesWriter {
        const to = calldata.readAddress();
        const tokenId = calldata.readU256();

        this._transfer(Blockchain.tx.sender, to, tokenId);

        return new BytesWriter(0);
    }

    @method(
        { name: 'from', type: ABIDataTypes.ADDRESS },
        { name: 'to', type: ABIDataTypes.ADDRESS },
        { name: 'tokenId', type: ABIDataTypes.UINT256 },
    )
    @emit('Transferred')
    public transferFrom(calldata: Calldata): BytesWriter {
        const from = calldata.readAddress();
        const to = calldata.readAddress();
        const amount = calldata.readU256();

        this._transfer(from, to, amount);

        return new BytesWriter(0);
    }

    @method(
        { name: 'to', type: ABIDataTypes.ADDRESS },
        { name: 'tokenId', type: ABIDataTypes.UINT256 },
        { name: 'data', type: ABIDataTypes.BYTES },
    )
    @emit('Transferred')
    public safeTransfer(calldata: Calldata): BytesWriter {
        const to = calldata.readAddress();
        const tokenId = calldata.readU256();
        const data = calldata.readBytesWithLength();

        this._safeTransfer(Blockchain.tx.sender, to, tokenId, data);

        return new BytesWriter(0);
    }

    @method(
        { name: 'from', type: ABIDataTypes.ADDRESS },
        { name: 'to', type: ABIDataTypes.ADDRESS },
        { name: 'tokenId', type: ABIDataTypes.UINT256 },
        { name: 'data', type: ABIDataTypes.BYTES },
    )
    @emit('Transferred')
    public safeTransferFrom(calldata: Calldata): BytesWriter {
        const from = calldata.readAddress();
        const to = calldata.readAddress();
        const tokenId = calldata.readU256();
        const data = calldata.readBytesWithLength();

        this._safeTransfer(from, to, tokenId, data);

        return new BytesWriter(0);
    }

    @method(
        { name: 'operator', type: ABIDataTypes.ADDRESS },
        { name: 'tokenId', type: ABIDataTypes.UINT256 },
    )
    @emit('Approved')
    public approve(calldata: Calldata): BytesWriter {
        const operator = calldata.readAddress();
        const tokenId = calldata.readU256();

        this._approve(operator, tokenId);

        return new BytesWriter(0);
    }

    @method({ name: 'tokenId', type: ABIDataTypes.UINT256 })
    public getApproved(calldata: Calldata): BytesWriter {
        const tokenId = calldata.readU256();
        if (!this._exists(tokenId)) throw new Revert('Token does not exist');

        const approved = this._addressFromU256(this.tokenApprovalMap.get(tokenId));
        const w = new BytesWriter(ADDRESS_BYTE_LENGTH);
        w.writeAddress(approved);
        return w;
    }

    @method(
        { name: 'operator', type: ABIDataTypes.ADDRESS },
        { name: 'approved', type: ABIDataTypes.BOOL },
    )
    @emit('ApprovedForAll')
    public setApprovalForAll(calldata: Calldata): BytesWriter {
        const operator = calldata.readAddress();
        const approved = calldata.readBoolean();

        if (operator === Blockchain.tx.sender) throw new Revert('Cannot approve self');

        this._setApprovalForAll(Blockchain.tx.sender, operator, approved);

        return new BytesWriter(0);
    }

    @method(
        { name: 'owner', type: ABIDataTypes.ADDRESS },
        { name: 'operator', type: ABIDataTypes.ADDRESS },
    )
    @returns({ name: 'approved', type: ABIDataTypes.BOOL })
    public isApprovedForAll(calldata: Calldata): BytesWriter {
        const owner = calldata.readAddress();
        const operator = calldata.readAddress();

        const approved: boolean = this._isApprovedForAll(owner, operator);
        const w = new BytesWriter(U8_BYTE_LENGTH);
        w.writeBoolean(approved);
        return w;
    }

    @method(
        { name: 'owner', type: ABIDataTypes.BYTES32 },
        { name: 'ownerTweakedPublicKey', type: ABIDataTypes.BYTES32 },
        { name: 'operator', type: ABIDataTypes.ADDRESS },
        { name: 'tokenId', type: ABIDataTypes.UINT256 },
        { name: 'deadline', type: ABIDataTypes.UINT64 },
        { name: 'signature', type: ABIDataTypes.BYTES },
    )
    @emit('Approved')
    public approveBySignature(calldata: Calldata): BytesWriter {
        const ownerAddress = calldata.readBytesArray(ADDRESS_BYTE_LENGTH);
        const ownerTweakedPublicKey = calldata.readBytesArray(ADDRESS_BYTE_LENGTH);

        const owner = new ExtendedAddress(ownerTweakedPublicKey, ownerAddress);

        const operator = calldata.readAddress();
        const tokenId = calldata.readU256();
        const deadline = calldata.readU64();
        const signature = calldata.readBytesWithLength();

        // Verify ownership
        const tokenOwner = this._ownerOf(tokenId);
        if (tokenOwner !== owner) throw new Revert('Not token owner');

        this._verifyApproveSignature(owner, operator, tokenId, deadline, signature);

        this._approve(operator, tokenId);

        return new BytesWriter(0);
    }

    @method(
        { name: 'owner', type: ABIDataTypes.BYTES32 },
        { name: 'ownerTweakedPublicKey', type: ABIDataTypes.BYTES32 },
        { name: 'operator', type: ABIDataTypes.ADDRESS },
        { name: 'approved', type: ABIDataTypes.BOOL },
        { name: 'deadline', type: ABIDataTypes.UINT64 },
        { name: 'signature', type: ABIDataTypes.BYTES },
    )
    @emit('Approved')
    public setApprovalForAllBySignature(calldata: Calldata): BytesWriter {
        const ownerAddress = calldata.readBytesArray(ADDRESS_BYTE_LENGTH);
        const ownerTweakedPublicKey = calldata.readBytesArray(ADDRESS_BYTE_LENGTH);

        const owner = new ExtendedAddress(ownerTweakedPublicKey, ownerAddress);

        const operator = calldata.readAddress();
        const approved = calldata.readBoolean();
        const deadline = calldata.readU64();
        const signature = calldata.readBytesWithLength();

        if (owner === operator) throw new Revert('Cannot approve self');

        this._verifySetApprovalForAllSignature(owner, operator, approved, deadline, signature);

        this._setApprovalForAll(owner, operator, approved);

        return new BytesWriter(0);
    }

    @method({ name: 'tokenId', type: ABIDataTypes.UINT256 })
    @emit('Transferred')
    public burn(calldata: Calldata): BytesWriter {
        const tokenId = calldata.readU256();
        this._burn(tokenId);
        return new BytesWriter(0);
    }

    @method()
    @returns({ name: 'domainSeparator', type: ABIDataTypes.BYTES32 })
    public domainSeparator(_: Calldata): BytesWriter {
        const w = new BytesWriter(32);
        w.writeBytes(this._buildDomainSeparator());
        return w;
    }

    @method(
        { name: 'owner', type: ABIDataTypes.ADDRESS },
        { name: 'index', type: ABIDataTypes.UINT256 },
    )
    @returns({ name: 'tokenId', type: ABIDataTypes.UINT256 })
    public tokenOfOwnerByIndex(calldata: Calldata): BytesWriter {
        const owner = calldata.readAddress();
        const index = calldata.readU256();

        const balance = this._balanceOf(owner);
        if (index >= balance) throw new Revert('Index out of bounds');

        const tokenArray = this._getOwnerTokenArray(owner);
        const tokenId = tokenArray.get(index.toU32());

        const w = new BytesWriter(U256_BYTE_LENGTH);
        w.writeU256(tokenId);
        return w;
    }

    @method({ name: 'owner', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'nonce', type: ABIDataTypes.UINT256 })
    public getApproveNonce(calldata: Calldata): BytesWriter {
        const owner = calldata.readAddress();
        const nonce = this._approveNonceMap.get(owner);
        const w = new BytesWriter(U256_BYTE_LENGTH);
        w.writeU256(nonce);
        return w;
    }

    @method({ name: 'baseURI', type: ABIDataTypes.STRING })
    @emit('URI')
    public setBaseURI(calldata: Calldata): BytesWriter {
        this.onlyDeployer(Blockchain.tx.sender);

        const baseURI: string = calldata.readStringWithLength();

        if (baseURI.length == 0) throw new Revert('Base URI cannot be empty');
        if (<u32>baseURI.length > MAX_URI_LENGTH) {
            throw new Revert('Base URI exceeds maximum length');
        }

        this._setBaseURI(baseURI);

        return new BytesWriter(0);
    }

    @method()
    @returns(
        { name: 'name', type: ABIDataTypes.STRING },
        { name: 'symbol', type: ABIDataTypes.STRING },
        { name: 'icon', type: ABIDataTypes.STRING },
        { name: 'banner', type: ABIDataTypes.STRING },
        { name: 'description', type: ABIDataTypes.STRING },
        { name: 'website', type: ABIDataTypes.STRING },
        { name: 'totalSupply', type: ABIDataTypes.UINT256 },
        { name: 'domainSeparator', type: ABIDataTypes.BYTES32 },
    )
    public metadata(_: Calldata): BytesWriter {
        const name = this.name;
        const symbol = this.symbol;
        const icon = this.collectionIcon;
        const banner = this.collectionBanner;
        const description = this.collectionDescription;
        const website = this.collectionWebsite;
        const domainSeparator = this._buildDomainSeparator();

        const nameLength = String.UTF8.byteLength(name);
        const symbolLength = String.UTF8.byteLength(symbol);
        const iconLength = String.UTF8.byteLength(icon);
        const bannerLength = String.UTF8.byteLength(banner);
        const descriptionLength = String.UTF8.byteLength(description);
        const websiteLength = String.UTF8.byteLength(website);

        const totalSize =
            U32_BYTE_LENGTH * 6 +
            nameLength +
            symbolLength +
            iconLength +
            bannerLength +
            descriptionLength +
            websiteLength +
            U256_BYTE_LENGTH * 2 +
            U32_BYTE_LENGTH +
            domainSeparator.length;

        const w = new BytesWriter(totalSize);
        w.writeStringWithLength(name);
        w.writeStringWithLength(symbol);
        w.writeStringWithLength(icon);
        w.writeStringWithLength(banner);
        w.writeStringWithLength(description);
        w.writeStringWithLength(website);
        w.writeU256(this.totalSupply);
        w.writeU256(this.maxSupply);
        w.writeBytesWithLength(domainSeparator);

        return w;
    }

    protected _mint(to: Address, tokenId: u256): void {
        if (to === Address.zero()) {
            throw new Revert('Cannot mint to zero address');
        }
        if (this._exists(tokenId)) {
            throw new Revert('Token already exists');
        }
        if (!this._maxSupply.value.isZero() && this._totalSupply.value >= this._maxSupply.value) {
            throw new Revert('Max supply reached');
        }

        // Set owner
        this.ownerOfMap.set(tokenId, this._u256FromAddress(to));

        // Add to enumeration
        this._addTokenToOwnerEnumeration(to, tokenId);

        // Update balance
        const currentBalance = this.balanceOfMap.get(to);
        this.balanceOfMap.set(to, SafeMath.add(currentBalance, u256.One));

        // Update total supply
        this._totalSupply.value = SafeMath.add(this._totalSupply.value, u256.One);

        this.createTransferEvent(Address.zero(), to, tokenId);
    }

    protected _burn(tokenId: u256): void {
        const owner = this._ownerOf(tokenId);

        // Check authorization
        if (
            owner !== Blockchain.tx.sender &&
            !this._isApprovedForAll(owner, Blockchain.tx.sender)
        ) {
            const approved = this._addressFromU256(this.tokenApprovalMap.get(tokenId));
            if (approved !== Blockchain.tx.sender) {
                throw new Revert('Not authorized to burn');
            }
        }

        // Clear approvals
        this.tokenApprovalMap.delete(tokenId);

        // Remove from enumeration
        this._removeTokenFromOwnerEnumeration(owner, tokenId);

        // Update balance
        const currentBalance = this.balanceOfMap.get(owner);
        this.balanceOfMap.set(owner, SafeMath.sub(currentBalance, u256.One));

        // Remove owner
        this.ownerOfMap.delete(tokenId);

        // Clear custom URI if exists
        const uriIndex = this.tokenURIIndices.get(tokenId);
        if (!uriIndex.isZero()) {
            this.tokenURIIndices.delete(tokenId);
        }

        // Update total supply
        this._totalSupply.value = SafeMath.sub(this._totalSupply.value, u256.One);

        this.createTransferEvent(owner, Address.zero(), tokenId);
    }

    protected _transfer(from: Address, to: Address, tokenId: u256): void {
        // Skip self-transfers
        if (from === to) return;

        const owner = this._ownerOf(tokenId);

        if (owner !== from) {
            throw new Revert('Transfer from incorrect owner');
        }

        if (to === Address.zero()) {
            throw new Revert('Transfer to zero address');
        }

        // Check authorization
        const sender = Blockchain.tx.sender;
        if (sender !== from && !this._isApprovedForAll(from, sender)) {
            const approved = this._addressFromU256(this.tokenApprovalMap.get(tokenId));
            if (approved !== sender) {
                throw new Revert('Not authorized to transfer');
            }
        }

        // Clear approval
        this.tokenApprovalMap.delete(tokenId);

        // Remove from old owner enumeration
        this._removeTokenFromOwnerEnumeration(from, tokenId);

        // Add to new owner enumeration
        this._addTokenToOwnerEnumeration(to, tokenId);

        // Update balances
        const fromBalance = this.balanceOfMap.get(from);
        this.balanceOfMap.set(from, SafeMath.sub(fromBalance, u256.One));

        const toBalance = this.balanceOfMap.get(to);
        this.balanceOfMap.set(to, SafeMath.add(toBalance, u256.One));

        // Transfer ownership
        this.ownerOfMap.set(tokenId, this._u256FromAddress(to));

        this.createTransferEvent(from, to, tokenId);
    }

    protected _safeTransfer(from: Address, to: Address, tokenId: u256, data: Uint8Array): void {
        this._transfer(from, to, tokenId);

        if (Blockchain.isContract(to)) {
            this._checkOnOP721Received(from, to, tokenId, data);
        }
    }

    protected _approve(operator: Address, tokenId: u256): void {
        // Validate to address
        if (operator === Address.zero()) throw new Revert('Cannot approve zero address');

        const owner = this._ownerOf(tokenId);
        if (operator === owner) throw new Revert('Approval to current owner');

        if (
            owner !== Blockchain.tx.sender &&
            !this._isApprovedForAll(owner, Blockchain.tx.sender)
        ) {
            throw new Revert('Not authorized to approve');
        }

        this.tokenApprovalMap.set(tokenId, this._u256FromAddress(operator));

        this.createApprovedEvent(owner, operator, tokenId);
    }

    protected _setApprovalForAll(owner: Address, operator: Address, approved: boolean): void {
        const operatorMap = this.operatorApprovalMap.get(owner);
        operatorMap.set(operator, approved ? u256.One : u256.Zero);
        this.operatorApprovalMap.set(owner, operatorMap);

        this.createApprovedForAllEvent(owner, operator, approved);
    }

    protected _isApprovedForAll(owner: Address, operator: Address): boolean {
        const operatorMap = this.operatorApprovalMap.get(owner);
        const approval = operatorMap.get(operator);
        return !approval.isZero();
    }

    protected _exists(tokenId: u256): bool {
        const owner = this.ownerOfMap.get(tokenId);
        return !owner.isZero();
    }

    protected _ownerOf(tokenId: u256): Address {
        const ownerU256 = this.ownerOfMap.get(tokenId);
        if (ownerU256.isZero()) {
            throw new Revert('Token does not exist');
        }
        return this._addressFromU256(ownerU256);
    }

    protected _balanceOf(owner: Address): u256 {
        if (owner === Address.zero()) {
            throw new Revert('Invalid address');
        }
        return this.balanceOfMap.get(owner);
    }

    protected _setTokenURI(tokenId: u256, uri: string): void {
        if (!this._exists(tokenId)) throw new Revert('Token does not exist');

        if (<u32>uri.length > MAX_URI_LENGTH) {
            throw new Revert('URI exceeds maximum length');
        }

        // Use incremental counter for URI storage
        const currentIndex = this._tokenURICounter.value.toU32();
        const uriStorage = new StoredString(tokenURIMapPointer, currentIndex);
        uriStorage.value = uri;

        // Store index reference
        this.tokenURIIndices.set(tokenId, u256.fromU32(currentIndex));

        // Increment counter for next URI
        this._tokenURICounter.value = SafeMath.add(this._tokenURICounter.value, u256.One);

        // Cache in memory
        this.tokenURIStorage.set(currentIndex, uriStorage);

        this.emitEvent(new URIEvent(uri, tokenId));
    }

    protected _checkOnOP721Received(
        from: Address,
        to: Address,
        tokenId: u256,
        data: Uint8Array,
    ): void {
        const calldata = new BytesWriter(
            SELECTOR_BYTE_LENGTH +
                ADDRESS_BYTE_LENGTH * 2 +
                U256_BYTE_LENGTH +
                U32_BYTE_LENGTH +
                data.length,
        );
        calldata.writeSelector(ON_OP721_RECEIVED_SELECTOR);
        calldata.writeAddress(Blockchain.tx.sender);
        calldata.writeAddress(from);
        calldata.writeU256(tokenId);
        calldata.writeBytesWithLength(data);

        const response = Blockchain.call(to, calldata);
        if (response.data.byteLength < SELECTOR_BYTE_LENGTH) {
            throw new Revert('Transfer rejected by recipient');
        }

        const retVal = response.data.readSelector();
        if (retVal !== ON_OP721_RECEIVED_SELECTOR) {
            throw new Revert('Transfer rejected by recipient');
        }
    }

    protected _verifyApproveSignature(
        owner: ExtendedAddress,
        spender: Address,
        tokenId: u256,
        deadline: u64,
        signature: Uint8Array,
    ): void {
        if (signature.length !== 64) {
            throw new Revert('Invalid signature length');
        }
        if (Blockchain.block.number > deadline) {
            throw new Revert('Signature expired');
        }

        const nonce = this._approveNonceMap.get(owner);

        const structWriter = new BytesWriter(
            32 + ADDRESS_BYTE_LENGTH * 2 + U256_BYTE_LENGTH * 2 + U64_BYTE_LENGTH,
        );
        structWriter.writeBytesU8Array(OP721_APPROVAL_TYPE_HASH);
        structWriter.writeAddress(owner);
        structWriter.writeAddress(spender);
        structWriter.writeU256(tokenId);
        structWriter.writeU256(nonce);
        structWriter.writeU64(deadline);

        const structHash = sha256(structWriter.getBuffer());
        this._verifySignature(structHash, owner, signature, nonce);
    }

    protected _verifySetApprovalForAllSignature(
        owner: ExtendedAddress,
        spender: Address,
        approved: boolean,
        deadline: u64,
        signature: Uint8Array,
    ): void {
        if (signature.length !== 64) {
            throw new Revert('Invalid signature length');
        }
        if (Blockchain.block.number > deadline) {
            throw new Revert('Signature expired');
        }

        const nonce = this._approveNonceMap.get(owner);

        const structWriter = new BytesWriter(
            32 + ADDRESS_BYTE_LENGTH * 2 + BOOLEAN_BYTE_LENGTH + U256_BYTE_LENGTH + U64_BYTE_LENGTH,
        );
        structWriter.writeBytesU8Array(OP721_APPROVAL_FOR_ALL_TYPE_HASH);
        structWriter.writeAddress(owner);
        structWriter.writeAddress(spender);
        structWriter.writeBoolean(approved);
        structWriter.writeU256(nonce);
        structWriter.writeU64(deadline);

        const structHash = sha256(structWriter.getBuffer());
        this._verifySignature(structHash, owner, signature, nonce);
    }

    protected _verifySignature(
        structHash: Uint8Array,
        owner: ExtendedAddress,
        signature: Uint8Array,
        nonce: u256,
    ): void {
        const messageWriter = new BytesWriter(2 + 32 + 32);
        messageWriter.writeU16(0x1901);
        messageWriter.writeBytes(this._buildDomainSeparator());
        messageWriter.writeBytes(structHash);

        const hash = sha256(messageWriter.getBuffer());

        if (!Blockchain.verifySignature(owner, signature, hash)) {
            throw new Revert('Invalid signature');
        }

        this._approveNonceMap.set(owner, SafeMath.add(nonce, u256.One));
    }

    protected _setBaseURI(baseURI: string): void {
        this._baseURI.value = baseURI;
    }

    protected override _buildDomainSeparator(): Uint8Array {
        const writer = new BytesWriter(32 * 5 + ADDRESS_BYTE_LENGTH);
        writer.writeBytesU8Array(OP712_DOMAIN_TYPE_HASH);

        // Hash the name string for domain separator
        const nameBytes = Uint8Array.wrap(String.UTF8.encode(this.name));
        writer.writeBytes(sha256(nameBytes));

        writer.writeBytesU8Array(OP712_VERSION_HASH);
        writer.writeBytes(Blockchain.chainId);
        writer.writeBytes(Blockchain.protocolId);
        writer.writeAddress(this.address);

        return sha256(writer.getBuffer());
    }

    // Enumeration helpers
    protected _addTokenToOwnerEnumeration(to: Address, tokenId: u256): void {
        const tokenArray = this._getOwnerTokenArray(to);
        const newIndex = tokenArray.getLength();
        tokenArray.push(tokenId);
        this.tokenIndexMap.set(tokenId, u256.fromU32(newIndex));
        tokenArray.save();
    }

    protected _removeTokenFromOwnerEnumeration(from: Address, tokenId: u256): void {
        const tokenArray = this._getOwnerTokenArray(from);
        const arrayLength = tokenArray.getLength();

        // Check for empty array
        if (arrayLength == 0) {
            throw new Revert('Token array is empty');
        }

        const lastIndex = arrayLength - 1;
        const tokenIndex = this.tokenIndexMap.get(tokenId).toU32();

        if (tokenIndex != lastIndex) {
            // Move last token to removed token's position
            const lastTokenId = tokenArray.get(lastIndex);
            tokenArray.set(tokenIndex, lastTokenId);
            this.tokenIndexMap.set(lastTokenId, u256.fromU32(tokenIndex));
        }

        // Remove last element
        tokenArray.deleteLast();
        this.tokenIndexMap.delete(tokenId);

        tokenArray.save();
    }

    /**
     * SECURITY NOTICE:
     *
     * This function uses a 30-byte truncation of addresses for storage pointer generation.
     * While this may appear to introduce collision risks, it is secure within the OP_NET
     * protocol context because:
     *
     * 1. All addresses in OP_NET are tweaked public keys (32-byte elliptic curve points)
     * 2. Tweaked public keys are uniformly distributed across the secp256k1 curve space
     * 3. Finding two public keys with identical 30-byte prefixes (240 bits) requires
     *    approximately 2^120 operations due to the birthday paradox
     * 4. The probability of accidentally generating colliding addresses through normal
     *    key generation is cryptographically negligible
     *
     * The truncation from 32 to 30 bytes is a space optimization that does not
     * meaningfully impact security given the uniform distribution of elliptic curve points.
     */
    protected _getOwnerTokenArray(owner: Address): StoredU256Array {
        // Truncate the 32-byte address to 30 bytes for the storage pointer
        // This is safe due to the uniform distribution of tweaked public keys
        const truncatedAddress = new Uint8Array(30);
        for (let i: i32 = 0; i < 30; i++) {
            truncatedAddress[i] = owner[i];
        }

        if (!this.ownerTokensMap.has(owner)) {
            const array = new StoredU256Array(ownerTokensMapPointer, truncatedAddress);
            this.ownerTokensMap.set(owner, array);
        }

        return this.ownerTokensMap.get(owner);
    }

    // Helper functions for 32-byte address conversions
    protected _u256FromAddress(addr: Address): u256 {
        // OP_NET addresses are already 32 bytes (tweaked public keys)
        // Direct conversion from 32-byte address to u256
        return u256.fromUint8ArrayBE(addr);
    }

    protected _addressFromU256(value: u256): Address {
        // Convert u256 back to 32-byte address
        const bytes = value.toUint8Array(true); // Returns 32 bytes in BE
        const addr = new Address([]);

        // Direct copy since both are 32 bytes
        for (let i: i32 = 0; i < 32; i++) {
            addr[i] = bytes[i];
        }

        return addr;
    }

    // Event creation helpers
    protected createTransferEvent(from: Address, to: Address, tokenId: u256): void {
        this.emitEvent(new TransferredEvent(Blockchain.tx.sender, from, to, tokenId));
    }

    protected createApprovedEvent(owner: Address, approved: Address, tokenId: u256): void {
        this.emitEvent(new ApprovedEvent(owner, approved, tokenId));
    }

    protected createApprovedForAllEvent(
        owner: Address,
        operator: Address,
        approved: boolean,
    ): void {
        this.emitEvent(new ApprovedForAllEvent(owner, operator, approved));
    }
}
