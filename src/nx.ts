import { Project } from './project';
import * as path from "path";
import * as fs from "fs";

function hasFiles(dir: string, ...names: string[]) {
    for (const name of names) {
        let file = path.resolve(dir, name);

        if (!fs.existsSync(file)) {
            return false;
        }
    }

    return true;
}

function copyEntries(output: any, input: any, key: string) {

    let map = input[key];

    if (map != null)
        for (const idx in map) {
            output[idx] = [key, map[idx]];
        }
}

export interface Dependency {

    type: string;

    version: string;

}

export class Nx {

    scope: string;

    baseDir: string;

    package: any;

    nx: any;

    workspace: any;

    dependencies: { [key: string]: Dependency } = {};

    projects: string[] = [];

    constructor(public output: string) {
        let dir = process.cwd();

        for (; ;) {
            if (hasFiles(dir, "workspace.json", "package.json", "nx.json")) {
                this.baseDir = dir;
                this.package = this.readJSON("package.json");
                this.nx = this.readJSON("nx.json");
                this.workspace = this.readJSON("workspace.json");
                this.scope = '@' + this.nx.npmScope as string;

                copyEntries(this.dependencies, this.package, 'peerDependencies');
                copyEntries(this.dependencies, this.package, 'devDependencies');
                copyEntries(this.dependencies, this.package, 'dependencies');

                for (let key in this.workspace['projects']) {
                    if (this.workspace.projects[key]['projectType'] === 'library') {
                        this.projects.push(key);
                        this.dependencies[`@${this.scope}/${key}`] = {
                            type: 'dependencies',
                            version: this.package.version
                        }
                    }
                }

                return;
            }

            let parent = path.resolve(dir, "..");

            if (parent == dir)
                throw new Error("No valid nx workspace found");

            dir = parent;
        }
    }

    readJSON(dir: string) {
        const file = path.resolve(this.baseDir, dir);
        const json = fs.readFileSync(file, "utf-8");
        return JSON.parse(json);
    }

    bundleAll() {
        return Promise.all(this.projects.map(project => this.bundle(project)));
    }

    bundle(name: string) {
        const project = new Project({
            name,
            scope: this.scope,
            dir: `libs/${name}`,
            fullName: `@${this.scope}/${name}`,
            version: this.package.version as string,
            dependency: name => this.dependency(name)
        });

        project.bundle().then(() => {
            project.write(this.output);
        });
    }

    dependency(name: string) {
        return this.dependencies[name];
    }
}