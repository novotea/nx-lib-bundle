# @novotea/nx-lib-bundle

## What is nx-lib-bundle

nx-lib-bundle is a minimalistic attempt at bundling NX workspace libraries in individual publishable npm packages. It has no dependencies on NX itself, but uses the layout conventions of NX to discover the version, npmScope and possible packages it can build.

## What will nx-lib-bundle do

Upon execution `nx-lib-bundle` will performs the following tasks:

* Look for `nx.json`, `workspace.json` and `package.json`
* Build node package files in `dist` with the npmScope and project name
* Use the version number of `package.json`
* Build flattenend ES5 and ES2015 versions of the projects in UMD and ES
  formats with sourcemaps included.
* The UMD format also contains a minified version
* Create typings for these projects
* Setup the corresponding package.json and set dependencies. The versions for these  
  dependencies will be taken from the nx `package.json`

`nx-lib-bundle` uses `rollup` and `uglify-js` to achieve its goals.

## How to install

```
npm i -D @novotea/nx-lib-bundle
```

## Usage

```
npx nx-lib-bundle
```

```
Usage:  [options] [command]

Create bundles from nx lib projects

Options:
  -o, --output <directory>  Output for packages
  -h, --help                display help for command

Commands:
  help|h                    this help
  bundle|b <projects>       Bundle libraries
  all|a                     Bundle all libraries
```

## How to create a bundle of all your library projects

```
npx nx-lib-bundle all
```

## How to bundle a specific project

```
npx nx-lib-bundle bundle <project>
```