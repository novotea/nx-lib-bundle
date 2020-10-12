[![Build Status](https://travis-ci.com/novotea/nx-lib-bundle.svg?token=vpX2zPATzHqVurs5axQZ&branch=master)](https://travis-ci.com/novotea/nx-lib-bundle)

# @novotea/nx-lib-bundle

## What is nx-lib-bundle

nx-lib-bundle is a minimalistic attempt at bundling NX workspace libraries in individual publishable npm packages. It has no dependencies on NX itself, but uses the layout conventions of NX to discover the version, npmScope and possible packages it can build.

## What will nx-lib-bundle do

Upon execution `nx-lib-bundle` will performs the following tasks:

* Look for `workspace.json` or `angular.json` and `nx.json` , `package.json`
* Build node package files in `dist` with the npmScope and project name
* Use the version number of `package.json`
* If a `package-template.json` is found in the workspace root, then its content will be added to the generated `package.json`
* If a `package-template.json` is found in a library project directory, then its content will be added to the generated `package.json`
* Build flattenend ES5 and ES2015 versions of the projects in UMD and ES
  formats with sourcemaps included
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
npx nx-lib-bundle --help
```

```
nx-lib-bundle <cmd> [args]

Commands:
  nx-lib-bundle all                   build all nx workspace libraries
  nx-lib-bundle bundle <projects...>  Bundle multiple nx workspace libraries

Options:
  --output, -o  Target directory of the bundle        [string] [default: "dist"]
  --version     Show version number                                    [boolean]
  --help        Show help                                              [boolean]
```
