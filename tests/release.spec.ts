import { TestProgram } from './lib';
import fs from 'fs';

import { describe, it } from 'mocha';
import { ArrayBuffer } from 'arraybuffer';

const makeProgram = (binary: ArrayBuffer) => {
    const program = new TestProgram(new Uint8Array(Array.from(binary)).buffer);
    program.on('log', (v) => console.log(v));
    return program;
};

describe('btc-runtime', () => {
    const makeTest = (s: string) =>
        it(s, async () => {
            const binary = fs.readFileSync('./build/tests.wasm');
            const program = makeProgram(binary);
            await program.run(s);
        });
    ['test_encode', 'test_log', 'test_writeStringWithLength'].forEach((v) => makeTest(v));
});
