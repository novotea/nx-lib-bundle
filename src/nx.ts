import { Project } from './project';

import * as cliProgress from 'cli-progress';
import * as fs from 'fs';
import * as path from 'path';

import { Dependency } from './dependency';

// tslint:disable:no-console

function ensurefile(dir: string, ...segments: string[]) {
    const file = path.resolve(dir, ...segments);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    return file;
}

function hasFiles(dir: string, ...names: string[]) {
    for (const name of names) {
        const file = path.resolve(dir, name);

        if (!fs.existsSync(file)) {
            return false;
        }
    }

    return true;
}

function copyEntries(output: any, input: any, key: string) {
    const map = input[key];

    if (map != null) {
        for (const idx of map) {
            output[idx] = [key, map[idx]];
        }
    }
}

export class Nx {
    public scope: string;

    public baseDir: string;

    public package: any;

    public nx: any;

    public workspace: any;

    public dependencies: { [key: string]: Dependency } = {};

    public projects: string[] = [];

    constructor(public output: string) {
        let dir = process.cwd();

        for (; ;) {
            if (hasFiles(dir, 'workspace.json', 'package.json', 'nx.json')) {
                this.baseDir = dir;
                this.package = this.readJSON('package.json');
                this.nx = this.readJSON('nx.json');
                this.workspace = this.readJSON('workspace.json');
                this.scope = ('@' + this.nx.npmScope) as string;

                copyEntries(this.dependencies, this.package, 'peerDependencies');
                copyEntries(this.dependencies, this.package, 'devDependencies');
                copyEntries(this.dependencies, this.package, 'dependencies');

                for (const key in this.workspace.projects) {
                    if (this.workspace.projects[key].projectType === 'library') {
                        this.projects.push(key);
                        this.dependencies[`${this.scope}/${key}`] = {
                            type: 'dependencies',
                            version: this.package.version,
                        };
                    }
                }

                return;
            }

            const parent = path.resolve(dir, '..');

            if (parent === dir) {
                throw new Error('No valid nx workspace found');
            }

            dir = parent;
        }
    }

    public async bundleAll() {
        return this.bundle(...this.projects);
    }

    public async bundle(...names: string[]) {
        for (const name of names) {
            const importName = `${this.scope}/${name}`;

            const bar = new cliProgress.SingleBar(
                {
                    format: `${importName}: {message}`,
                    fps: 25,
                },
                cliProgress.Presets.shades_classic,
            );

            const project = new Project({
                baseDir: this.baseDir,
                dependency: (dep) => this.dependency(dep),
                dir: `${this.baseDir}/libs/${name}`,
                importName,
                input: 'index.ts',
                name,
                srcpath: 'src',
                tsconfig: 'tsconfig.lib.json',
                version: this.package.version as string,
            });

            bar.start(0, 0, {
                message: 'Starting',
            });

            let n = 1;

            const output = path.resolve(this.baseDir, this.output, this.scope, name);

            const warnings: string[] = []

            await project.bundle({
                message: (...text) => {
                    bar.update(n++, {
                        message: text.join(' '),
                    });
                },
                warning: (text) => {
                    warnings.push(text);
                },
                emit: (file, content) => {
                    // console.log(file);
                    file = path.resolve(output, file);
                    ensurefile(file);
                    fs.writeFileSync(file, content, { encoding: 'utf-8' });
                }
            });

            bar.stop();

            if (warnings.length !== 0) {
                console.log(`${warnings.length} warning(s):`);
                warnings.forEach((w) => console.log('  ', w));
            }
        }
    }

    public dependency(name: string) {
        return this.dependencies[name];
    }

    private readJSON(dir: string) {
        const file = path.resolve(this.baseDir, dir);
        const json = fs.readFileSync(file, 'utf-8');
        return JSON.parse(json);
    }
}
