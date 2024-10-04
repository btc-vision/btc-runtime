'use strict';

import { getContractPaths, build, getTestPaths } from './lib.js';
import path from 'node:path';

(async () => {
    const paths = (await getContractPaths()).filter((v) => path.parse(v).ext === '.ts');
    for (const v of paths) {
        build(v);
    }
    let tests = (await getTestPaths()).filter((v) => path.parse(v).ext === '.ts');
    for (const v of tests) {
        build(v);
    }
})().catch((err) => console.error(err));
