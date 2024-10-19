import { default as _yargs } from 'yargs';
import { build } from './lib.js';
import path from 'path';

const yargs = _yargs(process.argv.slice(2));

if (!yargs.argv._[0]) {
    console.error('must supply contract as argument');
} else {
    build(path.join('runtime', yargs.argv._[0]));
}
