import { ABIRegistry } from './btc/universal/ABIRegistry';

export function defineSelectors(): void {
    ABIRegistry.defineGetterSelector('address', false);
    ABIRegistry.defineGetterSelector('owner', false);
    ABIRegistry.defineMethodSelector('isAddressOwner', false);

    ABIRegistry.defineMethodSelector('allowance', false);
    ABIRegistry.defineMethodSelector('approve', true);
    ABIRegistry.defineMethodSelector('balanceOf', false);
    ABIRegistry.defineMethodSelector('burn', true);
    ABIRegistry.defineMethodSelector('mint', true);
    ABIRegistry.defineMethodSelector('transfer', true);
    ABIRegistry.defineMethodSelector('transferFrom', true);

    ABIRegistry.defineGetterSelector('decimals', false);
    ABIRegistry.defineGetterSelector('name', false);
    ABIRegistry.defineGetterSelector('symbol', false);
    ABIRegistry.defineGetterSelector('totalSupply', false);
    ABIRegistry.defineGetterSelector('maxSupply', false);

    ABIRegistry.defineMethodSelector('stake', true);
    ABIRegistry.defineMethodSelector('unstake', true);
    ABIRegistry.defineMethodSelector('stakedAmount', false);
    ABIRegistry.defineMethodSelector('stakedReward', false);
    ABIRegistry.defineMethodSelector('claim', true);

    ABIRegistry.defineGetterSelector('rewardPool', false);
    ABIRegistry.defineGetterSelector('totalStaked', false);

    ABIRegistry.defineMethodSelector('addReward', true);

    /** WBTC */
    ABIRegistry.defineMethodSelector('requestWithdrawal', true);
    ABIRegistry.defineMethodSelector('withdrawableBalanceOf', false);
}

export * from './btc/exports';
