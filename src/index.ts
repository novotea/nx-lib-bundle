#!/usr/bin/env node

import * as yargs from 'yargs';
import { Nx } from './nx';

// tslint:disable-next-line:no-unused-expression
yargs
    .scriptName('nx-lib-bundle')
    .options({
        output: {
            alias: 'o',
            default: 'dist',
            demandOption: false,
            describe: 'Target directory of the bundle',
            type: 'string',
        },
    })
    // tslint:disable-next-line:no-empty
    .command(
        'all',
        'build all nx workspace libraries',
        () => {},
        (argv) => {
            return new Nx(argv.output).bundleAll();
        },
    )
    .command(
        'bundle <projects...>',
        'Bundle multiple nx workspace libraries',
        (cargs) => {
            cargs.positional('projects', {
                describe: 'name of the project',
            });
        },
        (argv) => {
            return new Nx(argv.output).bundle(...(argv.projects as string[]));
        },
    )
    .usage('$0 <cmd> [args]')
    .version('1.0.0')
    .help()
    .demandCommand()
    .strict().argv;
