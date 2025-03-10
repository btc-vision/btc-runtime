import { Revert } from '../types/Revert';

export function execute(_calldataLength: u32): u32 {
    throw new Revert(`UNIT TEST ONLY, METHOD NOT IMPLEMENTED.`);
}

export function onDeploy(_calldataLength: u32): u32 {
    throw new Revert(`UNIT TEST ONLY, METHOD NOT IMPLEMENTED.`);
}
