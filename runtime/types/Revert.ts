export class Revert extends Error {
    constructor(msg: string = '') {
        super(`Execution reverted ${msg}`);
    }
}
