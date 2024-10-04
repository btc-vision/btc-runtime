'use strict';

import fs from 'fs-extra';
import path from 'node:path';
import url from "node:url";
import child_process from 'node:child_process';
import { default as _yargs } from 'yargs';

const yargs = _yargs(process.argv);

const __dirname = path.parse(url.parse(import.meta.url).pathname).dir;

export const getContractPaths = async function getContractPaths() {
    const directory = path.join(__dirname, '..', 'runtime');
    return (await fs.readdir(directory)).map((v) => path.join('runtime', v));
};
export const build = (v) =>
    child_process.spawnSync(
        'yarn',
        [
            'asc',
            v,
            ...('--target release --measure -Ospeed --noAssert --optimizeLevel 3 --shrinkLevel 2 --converge --disable mutable-globals,sign-extension,nontrapping-f2i,bulk-memory --runtime stub --memoryBase 0 --lowMemoryLimit --uncheckedBehavior never --initialMemory 1 --maximumMemory 512 --outFile build/' + path.parse(v).name + ".wasm").split(' ')
//            ...('--target release --measure -Ospeed --noAssert --optimizeLevel 3 --shrinkLevel 2 --outFile build/' + path.parse(v).name + ' --exportRuntime --converge --disable sign-extension,nontrapping-f2i,bulk-memory --runtime stub --memoryBase 0 --lowMemoryLimit --uncheckedBehavior never --initialMemory 1 --maximumMemory 512' + (yargs.argv.notransform ? '' : ' --transform opnet-callable/transform')).split(
 //               ' ',
  //          )
        ],
        { stdio: 'inherit' },
    );
