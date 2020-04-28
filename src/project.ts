import { Bundle, BundleOptions, BundleEmitter } from './bundle';
import { Dependency } from './dependency';

import * as path from 'path';

export interface ProjectOutput {
    message: (...message: string[]) => void;

    warning: (text: string) => void;

    emit: (file: string, content: string | Uint8Array) => void;
}


export class Project {
    constructor(private output: ProjectOutput, private dependency: (name: string) => Dependency) { }

    // tslint:disable-next-line:no-empty
    public async bundle(options: BundleOptions) {
        const warnings: string[] = [];

        await this.bundleES5(options);
        await this.bundleES2015(options);
    }

    private async bundleES5(options: BundleOptions) {
        const es5 = await Bundle.build(this.output, options, 'es5', 'umd', true);

        const emitter: BundleEmitter = (name, content) => {
            this.output.emit(path.join('bundles', name), content);
        }

        es5.emitChunk(options.name + '.umd', emitter);
        es5.emitMinify(options.name + '.umd', emitter);
        es5.emitAssets(this.output.emit);

        const pkg: any = {
            fesm2015: `fesm2015/${options.name}.js`,
            main: `bundles/${options.name}.umd.js`,
            name: options.importName,
            typings: 'index.d.ts',
            version: options.version,
        };

        es5.imports?.forEach((name) => {
            const dependency = this.dependency(name);

            if (dependency != null) {
                let map = pkg[dependency.type];

                if (map == null) {
                    pkg[dependency.type] = map = {};
                }

                map[name] = dependency.version;
            }
        });

        this.output.emit('package.json', JSON.stringify(pkg, null, 2));
    }

    private async bundleES2015(options: BundleOptions) {
        const es2015 = await Bundle.build(this.output, options, 'es2015', 'es');

        const emitter: BundleEmitter = (name, content) => {
            this.output.emit(path.join('fesm2015', name), content);
        }


        es2015.emitChunk(options.name, emitter);
    }
}
