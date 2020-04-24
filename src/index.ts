#!/usr/bin/env node

import * as commander from 'commander';
import { Nx } from './nx';

let output = 'dist';

commander
    .option('-o, --output <directory>', "Output for packages", v => {output=v;});

commander
    .description("Create bundles from nx lib projects");

commander
    .command('help')
    .alias('h')
    .description('this help')
    .action(() => {
        commander.help();
    });

commander
    .command('bundle <projects>')
    .alias('b')
    .description('Bundle libraries')
    .action((projects, cmd) => {
        let workspace = new Nx(output);

        for(const project of cmd.args) {
            workspace.bundle(project);
        }
    });

commander
    .command('all')
    .alias('a')
    .description('Bundle all libraries')
    .action((projects, cmd) => {
        let workspace = new Nx(output);
        workspace.bundleAll();
    });

if (process.argv.length <= 2)
    commander.help();
else
    commander.parse(process.argv);