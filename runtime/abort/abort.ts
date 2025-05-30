import { Revert } from '../types/Revert';

export function revertOnError(message: string, fileName: string, line: u32, column: u32): void {
    throw new Revert(`UNIT TEST ONLY, METHOD NOT DEFINED.`);
}
