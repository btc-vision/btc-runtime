import { DeployableOP_20 } from './DeployableOP_20';
import { u256 } from '@btc-vision/as-bignum/assembly';
import { OP20InitParameters } from './interfaces/OP20InitParameters';

export abstract class OP_20 extends DeployableOP_20 {
    protected constructor(maxSupply: u256, decimals: u8, name: string, symbol: string) {
        super(new OP20InitParameters(maxSupply, decimals, name, symbol));
    }
}
