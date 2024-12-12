import { u256 } from '@btc-vision/as-bignum/assembly';
import { Address } from '../types/Address';

export class DeployContractResponse {
    readonly virtualAddress: u256;
    readonly contractAddress: Address;

    constructor(virtualAddress: u256, contractAddress: Address) {
        this.virtualAddress = virtualAddress;
        this.contractAddress = contractAddress;
    }
}
