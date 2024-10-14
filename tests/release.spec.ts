import { readFile } from 'fs-extra';
import { TestProgram } from './lib';

import { ArrayBuffer } from 'arraybuffer';
import { describe, it } from 'mocha';

const makeProgram = (binary: ArrayBuffer) => {
    const program = new TestProgram(new Uint8Array(Array.from(binary)).buffer);
    program.on('log', (v) => console.log(v));
    return program;
};

describe('btc-runtime', () => {
    const makeTest = (s) =>
        it(s, async () => {
            const binary = await readFile('./build/tests.wasm');
            const program = makeProgram(binary);
            const result = await program.run(s);
        });
    ['test_encode', 'test_log', 'test_writeStringWithLength'].forEach((v) => makeTest(v));
});
