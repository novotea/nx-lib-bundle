import { Dependency } from './nx';
import * as path from "path";
import * as fs from "fs";
import * as rollup from "rollup";
import * as typescript from '@rollup/plugin-typescript';
import * as uglifyjs from "uglify-js";

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

    dependency: (name: string) => Dependency
}

export class Project {

    es5?: Bundle;

    es2015?: Bundle;

    constructor(public options: ProjectOptions) {
    }

    bundle(input = 'src/index.ts', tsconfig = 'tsconfig.lib.json') {
        return Promise.all([
            new Bundle(this.options, "es5", "umd", true).bundle(input, tsconfig).then(o => {
                this.es5 = o;
            }),
            new Bundle(this.options, "es2015", "es").bundle(input, tsconfig).then(o => {
                this.es2015 = o;
            })
        ]);
    }

    write(dir: string) {
        this.es5?.write(path.resolve(dir, this.options.scope, this.options.name, 'bundles'), this.options.name + '.umd');
        this.es5?.typings(path.resolve(dir, this.options.scope, this.options.name));
        this.es2015?.write(path.resolve(dir, this.options.scope, this.options.name, 'fesm2015'), this.options.name);

        const pkg: any = {
            name: this.options.fullName,
            version: this.options.version,
            main: `bundles/${this.options.name}.umd.js`,
            fesm2015: `fesm2015/${this.options.name}.js`,
            typings: 'index.d.ts',
        };

        this.es5?.imports?.forEach(name => {
            const dependency = this.options.dependency(name);

            if (dependency != null) {
                let map = pkg[dependency.type];

                if (map == null)
                    pkg[dependency.type] = map = {};

                map[name] = dependency.version;
            }
        });

        fs.writeFileSync(path.resolve(dir, this.options.scope, this.options.name, "package.json"), JSON.stringify(pkg, null, 4), { encoding: 'utf-8' });
    }
}

class Bundle {

    imports?: string[];

    build?: rollup.RollupOutput;

    min?: uglifyjs.MinifyOutput;

    constructor(public options: ProjectOptions, public target: string, public format: "es" | "umd", public minify = false) {
    }

    bundle(input = 'src/index.ts', tsconfig = 'tsconfig.lib.json', base = 'src') {

        return rollup.rollup({
            input: path.resolve(this.options.dir, input),
            external: function (id) {
                return !(id.startsWith('.') || id.startsWith('/') || id == ('\0typescript-helpers'));
            },
            plugins: [(typescript as any)({
                target: this.target,
                outDir: `.`,
                inlineSources: true,
                inlineSourceMap: true,
                declaration: true,
                declarationMap: true,
                tsconfig: path.resolve(this.options.dir, tsconfig)
            })]
        }).then(bundle => {
            return bundle.generate({
                format: this.format,
                name: this.options.fullName,
                sourcemap: true,
                dir: '.',
                globals: id => id
            }).then(result => {
                this.build = result;

                for (const asset of result.output) {
                    if (asset.type === 'chunk') {
                        const map = asset.map!;

                        this.imports = asset.imports;

                        map.sources = map.sources.map(file => this.options.fullName + '/' + path.relative(this.options.dir, file));

                        if (this.minify) {
                            this.min = uglifyjs.minify(asset.code, {
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

                        break;
                    }
                }

                return this;
            });
        });
    }

    write(dir: string, name: string) {
        for (let output of this.build!.output) {
            if (output.type === 'chunk') {
                const mapname = `${name}.js.map`;
                const ref = `\n//# sourceMappingURL=${mapname}`;
                fs.writeFileSync(ensurefile(dir, `${name}.js`), output.code + ref, { encoding: 'utf-8' });
                fs.writeFileSync(ensurefile(dir, mapname), JSON.stringify(output.map), { encoding: 'utf-8' });
            }
        }

        if (this.min != null) {
            const mapname = `${name}.min.js.map`;
            const ref = `\n//# sourceMappingURL=${mapname}`;
            fs.writeFileSync(ensurefile(dir, `${name}.min.js`), this.min.code + ref, { encoding: 'utf-8' });
            fs.writeFileSync(ensurefile(dir, mapname), JSON.stringify(this.min.map), { encoding: 'utf-8' });
        }
    }

    typings(dir: string, prefix = 'src') {
        for (let output of this.build!.output) {
            if (output.type === 'asset') {
                const file = path.relative(path.resolve(this.options.dir, prefix), output.fileName);
                fs.writeFileSync(ensurefile(dir, file), output.source, { encoding: 'utf-8' });
            }
        }
    }
}