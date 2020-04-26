import * as path from "path";
import * as fs from "fs";
import * as rollup from "rollup";
import * as typescript from '@rollup/plugin-typescript';
import * as uglifyjs from "uglify-js";

import { Dependency } from "./dependency";
import { collapseTextChangeRangesAcrossMultipleVersions } from 'typescript';

function ensurefile(dir: string, ...segments: string[]) {
    const file = path.resolve(dir, ...segments);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    return file;
}

export interface ProjectOptions {

    dir: string;

    scope: string;

    name: string;

    fullName: string;

    version: string;

    tsconfig: string;

    input: string;

    srcpath: string;

    dependency: (name: string) => Dependency
}

interface Bundle {

    imports: string[];

    rollup: rollup.RollupOutput;

    minify?: uglifyjs.MinifyOutput;

    warnings: string[];

}

type BundleEmitter = (name: string, content: string | Uint8Array) => void;

type ProgressOutput = (...message: string[]) => void;

export class Project {

    constructor(public options: ProjectOptions) {
    }

    async bundle(dir: string, progress: ProgressOutput) {
        const warnings:string[] = [];

        (await this.bundleES5(dir, progress)).forEach(w => warnings.push(`ES5 build: ${w}`));
        (await this.bundleES2015(dir, progress)).forEach(w => warnings.push(`ES215 build: ${w}`));

        return warnings;
    }

    private async bundleES5(dir: string, progress: ProgressOutput) {
        let es5 = await this.build(progress, "es5", "umd", true);

        this.emitter(emitter => {

            this.emitChunk(es5, this.options.name + '.umd', emitter);

            this.emitMinify(es5, this.options.name + '.umd', emitter);

        }, progress, dir, this.options.scope, this.options.name, 'bundles');

        this.emitter((emitter, dir) => {

            this.emitTypings(es5, emitter);

            const pkg: any = {
                name: this.options.fullName,
                version: this.options.version,
                main: `bundles/${this.options.name}.umd.js`,
                fesm2015: `fesm2015/${this.options.name}.js`,
                typings: 'index.d.ts',
            };

            es5.imports?.forEach(name => {
                const dependency = this.options.dependency(name);

                if (dependency != null) {
                    let map = pkg[dependency.type];

                    if (map == null)
                        pkg[dependency.type] = map = {};

                    map[name] = dependency.version;
                }
            });

            emitter("package.json", JSON.stringify(pkg, null, 2))

        }, progress, dir, this.options.scope, this.options.name);

        return es5.warnings;
    }

    private async bundleES2015(dir: string, progress: ProgressOutput) {
        let es2015 = await this.build(progress, "es2015", "es");

        this.emitter(emitter => {

            this.emitChunk(es2015, this.options.name, emitter);

        }, progress, dir, this.options.scope, this.options.name, 'fesm2015')

        return es2015.warnings;
    }

    private emitter(action: (emitter: BundleEmitter, dir: string) => void, progress: ProgressOutput, base: string, ...segments: string[]) {
        let dir = path.resolve(base, ...segments);

        let emitter: BundleEmitter = (name, content) => {
            let file = ensurefile(dir, name);

            progress("Writing", path.relative(base, file));

            fs.writeFileSync(file, content, { encoding: 'utf-8' });
        }

        action(emitter, dir);
    }

    private async build(progress: ProgressOutput, target: string, format: "es" | "umd", minify = false): Promise<Bundle> {

        let warnings: rollup.RollupWarning[] = [];

        progress("Bundling", this.options.fullName, "for target", target, "and format", format);

        let rollupInput = await rollup.rollup({
            input: path.resolve(this.options.dir, this.options.srcpath, this.options.input),
            external: function (id) {
                return !(id.startsWith('.') || id.startsWith('/') || id == ('\0typescript-helpers'));
            },
            onwarn: (warning) => warnings.push(warning),
            plugins: [(typescript as any)({
                target,
                outDir: `.`,
                inlineSources: true,
                inlineSourceMap: true,
                declaration: true,
                declarationMap: true,
                tsconfig: path.resolve(this.options.dir, this.options.tsconfig)
            })]
        });

        progress("Generating code for ", this.options.fullName, "for target", target, "and format", format);

        let rollupOutput = await rollupInput.generate({
            format,
            name: this.options.fullName,
            sourcemap: true,
            dir: '.',
            globals: id => id
        });

        let imports: string[] = [];

        let minifyOutput = undefined;

        let srcpath = path.resolve(this.options.dir, this.options.srcpath);

        for (const asset of rollupOutput.output) {
            if (asset.type === 'chunk') {
                if (minifyOutput == null) {
                    const map = asset.map!;

                    imports = asset.imports;

                    map.sources = map.sources.map(file => this.options.fullName + '/' + path.relative(this.options.dir, file));

                    if (minify) {
                        progress("Minifying ", this.options.fullName);

                        minifyOutput = uglifyjs.minify(asset.code, {
                            sourceMap: {
                                content: {
                                    mappings: map.mappings,
                                    names: map.names,
                                    sources: map.sources,
                                    version: map.version.toString(),
                                    file: map.file,
                                    sourcesContent: map.sourcesContent
                                }
                            }
                        });
                    }
                } else {
                    throw new Error(`Project ${this.options.fullName} has multiple chunks`);
                }
            } else {
                asset.fileName = path.relative(srcpath, asset.fileName);
            }
        }

        return {
            rollup: rollupOutput,
            imports,
            minify: minifyOutput,
            warnings: warnings.map(m => m.toString())
        };
    }

    private emitChunk(bundle: Bundle, name: string, emitter: BundleEmitter) {
        for (let output of bundle.rollup.output) {
            if (output.type === 'chunk') {
                const mapname = `${name}.js.map`;
                const ref = `\n//# sourceMappingURL=${mapname}`;
                emitter(`${name}.js`, output.code + ref);
                emitter(mapname, JSON.stringify(output.map));
            }
        }
    }

    private emitMinify(bundle: Bundle, name: string, emitter: BundleEmitter) {
        if (bundle.minify != null) {
            const mapname = `${name}.min.js.map`;
            const ref = `\n//# sourceMappingURL=${mapname}`;
            emitter(`${name}.min.js`, bundle.minify.code + ref);
            emitter(mapname, JSON.stringify(bundle.minify.map));
        }
    }

    private emitTypings(bundle: Bundle, emitter: BundleEmitter) {
        for (let output of bundle.rollup.output) {
            if (output.type === 'asset')
                emitter(output.fileName, output.source);
        }
    }
}