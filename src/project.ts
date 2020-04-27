import * as typescript from '@rollup/plugin-typescript';
import * as fs from 'fs';
import * as path from 'path';
import * as rollup from 'rollup';
import * as uglifyjs from 'uglify-js';

import { Dependency } from './dependency';

export interface ProjectOptions {
    baseDir: string;

    dir: string;

    name: string;

    importName: string;

    version: string;

    tsconfig: string;

    input: string;

    srcpath: string;

    dependency: (name: string) => Dependency;
}

export interface ProjectOutput {
    message: (...message: string[]) => void;

    warning: (text: string) => void;

    emit: (file: string, content: string | Uint8Array) => void;
}

interface Bundle {
    imports: string[];

    rollup: rollup.RollupOutput;

    minify?: uglifyjs.MinifyOutput;
}

export class Project {
    constructor(public options: ProjectOptions) {}

    // tslint:disable-next-line:no-empty
    public async bundle(output: ProjectOutput) {
        const warnings: string[] = [];

        await this.bundleES5(output);
        await this.bundleES2015(output);

        return warnings;
    }

    private async bundleES5(output: ProjectOutput) {
        const es5 = await this.build(output, 'es5', 'umd', true);

        this.emitChunk(es5, 'bundles', this.options.name + '.umd', output);
        this.emitMinify(es5, 'bundles', this.options.name + '.umd', output);
        this.emitAssets(es5, output);

        const pkg: any = {
            fesm2015: `fesm2015/${this.options.name}.js`,
            main: `bundles/${this.options.name}.umd.js`,
            name: this.options.importName,
            typings: 'index.d.ts',
            version: this.options.version,
        };

        es5.imports?.forEach((name) => {
            const dependency = this.options.dependency(name);

            if (dependency != null) {
                let map = pkg[dependency.type];

                if (map == null) {
                    pkg[dependency.type] = map = {};
                }

                map[name] = dependency.version;
            }
        });

        output.emit('package.json', JSON.stringify(pkg, null, 2));
    }

    private async bundleES2015(output: ProjectOutput) {
        const es2015 = await this.build(output, 'es2015', 'es');

        this.emitChunk(es2015, 'fesm2015', this.options.name, output);
    }

    private async build(output: ProjectOutput, target: string, format: 'es' | 'umd', minify = false): Promise<Bundle> {
        output.message('Bundling', this.options.name, 'for target', target, 'and format', format);

        const srcpath = path.resolve(this.options.dir, this.options.srcpath);

        const rollupInput = await rollup.rollup({
            external: (id) => {
                return !(id.startsWith('.') || id.startsWith('/') || id === '\0typescript-helpers');
            },
            input: path.resolve(this.options.dir, this.options.srcpath, this.options.input),
            onwarn: (warning) => output.warning(warning.message),
            plugins: [
                (typescript as any)({
                    declaration: true,
                    declarationMap: true,
                    inlineSourceMap: true,
                    inlineSources: true,
                    outDir: '.',
                    target,
                    tsconfig: path.resolve(this.options.dir, this.options.tsconfig),
                }),
            ],
        });

        output.message('Generating code for ', this.options.name, 'for target', target, 'and format', format);

        const rollupOutput = await rollupInput.generate({
            dir: '.',
            format,
            globals: (id) => id,
            name: this.options.importName,
            sourcemap: true,
        });

        let imports: string[] = [];

        let minifyOutput;

        for (const asset of rollupOutput.output) {
            if (asset.type === 'chunk') {
                if (minifyOutput == null) {
                    const map = asset.map!;

                    imports = asset.imports;

                    map.sources = map.sources.map((file) =>
                        path.join(this.options.importName, path.relative(this.options.dir, file)),
                    );

                    if (minify) {
                        output.message('Minifying ', this.options.name);

                        minifyOutput = uglifyjs.minify(asset.code, {
                            sourceMap: {
                                content: {
                                    file: map.file,
                                    mappings: map.mappings,
                                    names: map.names,
                                    sources: map.sources,
                                    sourcesContent: map.sourcesContent,
                                    version: map.version.toString(),
                                },
                            },
                        });
                    }
                } else {
                    throw new Error(`Project ${this.options.name} has multiple chunks`);
                }
            } else {
                asset.fileName = path.relative(srcpath, asset.fileName);
            }
        }

        return {
            imports,
            minify: minifyOutput,
            rollup: rollupOutput,
        };
    }

    private emitChunk(bundle: Bundle, dir: string, name: string, output: ProjectOutput) {
        for (const chunk of bundle.rollup.output) {
            if (chunk.type === 'chunk') {
                const mapname = `${name}.js.map`;
                const ref = `\n//# sourceMappingURL=${mapname}`;
                output.emit(path.join(dir, `${name}.js`), chunk.code + ref);
                output.emit(path.join(dir, mapname), JSON.stringify(chunk.map));
            }
        }
    }

    private emitMinify(bundle: Bundle, dir: string, name: string, output: ProjectOutput) {
        if (bundle.minify != null) {
            const mapname = `${name}.min.js.map`;
            const ref = `\n//# sourceMappingURL=${mapname}`;
            output.emit(path.join(dir, `${name}.min.js`), bundle.minify.code + ref);
            output.emit(path.join(dir, mapname), JSON.stringify(bundle.minify.map));
        }
    }

    private emitAssets(bundle: Bundle, output: ProjectOutput) {
        for (const asset of bundle.rollup.output) {
            if (asset.type === 'asset') {
                output.emit(asset.fileName, asset.source);
            }
        }
    }
}
