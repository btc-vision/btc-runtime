import { Address } from '../types/Address';

export interface IBTC {
    readonly contractDeployer: Address;
    readonly address: Address;
}
