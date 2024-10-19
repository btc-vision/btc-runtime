'use strict';

import fs from 'fs';
import path from 'node:path';
import url from 'node:url';
import child_process from 'node:child_process';

const __dirname = path.parse(url.parse(import.meta.url).pathname).dir;

export const getContractPaths = async function getContractPaths() {
    const directory = path.join(__dirname, '..', 'runtime');
    return fs.readdirSync(directory).map((v) => path.join('runtime', v));
};

export function build(v) {
    console.log('Building contract:', v);

    const command = [
        'asc',
        v,
        ...(
            '--target release --measure -Ospeed --noAssert --optimizeLevel 3 --shrinkLevel 2 --converge --disable mutable-globals,sign-extension,nontrapping-f2i,bulk-memory --runtime stub --memoryBase 0 --lowMemoryLimit --uncheckedBehavior never --initialMemory 1 --maximumMemory 512 --outFile build/' +
            path.parse(v).name +
            '.wasm'
        ).split(' '),
    ].join(' ');

    console.log('Running command:', command);

    return child_process.execSync(command, { stdio: 'inherit', stderr: 'inherit' });
}
