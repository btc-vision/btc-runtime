import { DeployableOP_20, OP20InitParameters } from './DeployableOP_20';
import { u256 } from 'as-bignum';

export abstract class OP_20 extends DeployableOP_20 {
    protected constructor(maxSupply: u256, decimals: u8, name: string, symbol: string) {
        super(new OP20InitParameters(maxSupply, decimals, name, symbol));
    }
}
