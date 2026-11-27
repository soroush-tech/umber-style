# Releasing

After this page you can publish the packages to npm, try a change in a real app before it reaches everyone, install a prerelease as a consumer, and check that what npm holds is what you meant to ship.

The packages are `@umber-style/core`, `@umber-style/cache`, `@umber-style/server`, `@umber-style/css`, `@umber-style/is-prop-valid`, `@umber-style/react`, `@umber-style/react-native`, `@umber-style/vue`, `@umber-style/styled` and `umber-style`: every folder of `packages/` that is not private. They are published by one workflow, by hand, never from a push or a merge.

## Channels

A release goes through one of three channels. `package.json` always holds the target version (`0.1.0`), never a prerelease: the workflow adds the suffix in its own checkout and commits nothing.

| Channel  | Published as    | npm dist-tag | Run from                              | GitHub Release |
| -------- | --------------- | ------------ | ------------------------------------- | -------------- |
| `alpha`  | `X.Y.Z-alpha.N` | `alpha`      | any branch whose `ci-ok` check passed | none           |
| `rc`     | `X.Y.Z-rc.N`    | `rc`         | `main`                                | pre-release    |
| `stable` | `X.Y.Z`         | `latest`     | `main`                                | release        |

`N` is one above the highest `X.Y.Z-<channel>.N` already on npm, and `0` when there is none. Nobody edits it. The first alpha of `0.1.0` is `0.1.0-alpha.0`.

A prerelease never lands on `latest`: it is always published under its channel's tag, and the run fails if `latest` ever points at one. A version already on npm is skipped, and a target that is already released cannot get a prerelease. A change that alters behaviour or the API goes alpha, then rc, then stable. Only a maintenance or documentation-only patch may go straight to stable.

## Before the first dispatch

1. Set `version` in each `package.json` to the target, following [semver](https://semver.org): a patch for a fix, a minor for new API, a major for a break. Raising the peer range of `react`, `react-native` or `vue` past what consumers have counts as a break.
2. Add `packages/<package>/release-notes/<version>.md`. It starts with `## <name>@<version>`, says in one line what changed and links the issue with an absolute URL, then lists only the sections that apply: Added, Changed, Fixed, BREAKING CHANGES (with the migration), Packaging (peer ranges, dependency changes). One file per target, never one per alpha or rc: update it as the alphas go.
3. `pnpm check:release-notes` fails if a publishable package has no notes for its version, and, in the pre-commit hook, if a staged package is not ahead of the version that `latest` points to on npm. CI runs the first check.
4. `pnpm smoke:packed` builds the packages and runs the packed-tarball test below. CI runs it for every pull request.

## Dispatch

In the repository on GitHub, open Actions, choose **CD - Packages (npm)**, and Run workflow:

- **Use workflow from**: the branch. For `alpha` it is the branch with the change, once its CI has passed. For `rc` and `stable` it must be `main`.
- **package**: one package, or `all`. `all` publishes every package whose version is not on npm yet, in order.
- **channel**: `alpha`, `rc` or `stable`.

The packages depend on each other, so they go out dependencies first:

1. `@umber-style/core` and `@umber-style/is-prop-valid`, which depend on no other package of the family
2. `@umber-style/cache`, `@umber-style/server`, `@umber-style/css`, `@umber-style/react-native`, `@umber-style/vue`, which depend on the core alone, and `@umber-style/react`, which depends on the core and `@umber-style/is-prop-valid`
3. `@umber-style/styled`, which depends on `@umber-style/react` alone, and `umber-style`, which depends on the core and the three bindings

The cache, server and css packages are not in `umber-style`: `@umber-style/server` uses `@umber-style/cache` in its tests only (a `devDependency`), so the two can go out in either order.

`all` orders itself. With a named package, publish its dependencies first: a prerelease run points each dependency that is not in the run at its newest version on the same channel, and stops with a message to publish that dependency first when there is none. A stable run stops the same way when the version of a dependency is not on npm.

### Dependencies between the packages

A package declares each sibling it depends on as `workspace:^`, in `dependencies` and in `peerDependencies`, which pnpm publishes as a caret range on the sibling's version: `umber-style@0.2.0` depends on `@umber-style/core` `^0.2.0`. Under 1.0.0 a caret holds the minor: `^0.2.0` takes `0.2.1` and not `0.3.0`. Up to 0.1.0 the siblings were `workspace:*`, which publishes the exact version: then a patch of one package, released alone, made every package that pinned the older version install a second copy of it under itself, and two copies of the core in one app keep apart what they do not share (see [How it works](how-it-works.md#two-copies-in-one-program)). From 0.2.0 a package can be patched alone: its dependents take the patch within their range, and an app keeps one copy. A `devDependency` on a sibling stays `workspace:*`: it never reaches a consumer. `pnpm smoke:packed` fails when a sibling in `dependencies` or `peerDependencies` is declared any other way, and checks that the packed `package.json` holds `^<version>`.

A prerelease run sets the version of each dependency outside the run to its newest prerelease on the channel, so a dependent publishes `^0.2.0-rc.0`. That range takes the later prereleases of the same version (`0.2.0-rc.1`) and the release `0.2.0` and its patches, and no prerelease of another version. An alpha range (`^0.2.0-alpha.0`) also takes the rcs of that version, which sort after the alphas.

The run does these things, in this order, and stops at the first one that fails:

1. Checks the branch, and for an alpha that `ci-ok` passed on the commit.
2. Checks that every package of the run has release notes for its target version.
3. Installs, makes sure the npm CLI can publish with Trusted Publishing, and sets the channel's versions.
4. Builds the packages and runs the packed-tarball test on those versions. Nothing has reached npm yet.
5. Publishes each package with `pnpm publish` under the channel's tag. A package that fails stops the run, because the ones after it depend on it; run it again and what is already on npm is skipped.
6. For `rc` and `stable`, creates a GitHub Release for each package, tagged `<name>@<version>`, with the notes file as its body, and does nothing when the release exists. An rc is a pre-release and is never marked latest.

Then a second job, `bench-report`, makes the benchmark report of what was published: once the registry lists the new version, the scenarios of the gate run with the new version, the last stable and, for an alpha or an rc, the previous one of its channel, each installed from npm, through the action `soroush-tech/bench-action` with no minimum ratio. Only `@umber-style/core` has these scenarios; the other packages get a line that says so. The report is in the summary of the run and, for an rc or a stable release, below the notes of its GitHub Release (the notes file is not changed). The report never fails the release: when it cannot run, the summary says so. How to read it: [Benchmarks](benchmarks.md#the-report-after-a-release).

Publishing uses npm Trusted Publishing: the run gets a short-lived token from GitHub and npm verifies it against the trusted publisher of each package (organization `soroush-tech`, repository `umber-style`, workflow `cd-packages.yml`, environment `cd-packages`). There is no npm token in the repository.

## Install a prerelease

A consumer never gets a prerelease by accident: `^0.1.0` and `@latest` skip them. An app opts in by tag or by exact version:

```sh
pnpm add @umber-style/react@alpha @umber-style/core@alpha
pnpm add @umber-style/react@rc
pnpm add @umber-style/react@0.1.0-alpha.2
```

Install the packages of one family on the same tag: each takes the newest version of its siblings that its range allows, which may be a later prerelease of the same version. Something wrong: fix it, push, wait for green CI, dispatch again, and the next `alpha.N` follows. To move an app to the release, change the tag to `^0.1.0`.

After a stable release, `pnpm deprecate-alpha` deprecates the alphas whose release is now on npm, pointing each at the release. It asks for npm's one-time code, and `--dry-run` only lists them.

## Verify what npm holds

The workspace consumes TypeScript source. What npm hands out is `dist`, swapped in by `publishConfig` when `pnpm pack` or `pnpm publish` runs. `npm publish` does not apply that swap and ships a package that cannot be imported, so always publish through the workflow or `pnpm`. Check the published artifact, not only the metadata:

```sh
npm pack @umber-style/react@0.1.0
tar -xzf umber-style-react-0.1.0.tgz -O package/package.json
# exports, main, module and types must point at ./dist/*, and nothing at ./src
tar -tzf umber-style-react-0.1.0.tgz
# LICENSE, README.md, package.json and dist/ only
```

If a broken version went out, it cannot be overwritten: bump, publish again, then `npm deprecate '<name>@<range>' 'Broken; use >=<fixed>.'`.

### The packed-tarball test

`pnpm smoke:packed` (`scripts/smoke-packed.mjs`) does the same check before a release, from outside the workspace. It packs every package with `pnpm pack`, in the order above, and inspects each tarball: not private, `exports`, `main`, `module` and `types` all in `dist` and present (`@umber-style/is-prop-valid` has no root entry, and so no `main`, `module` or `types`), no reference to `src`, no `workspace:` range left in its dependencies, each sibling it depends on as `^<version>` (and `workspace:^` in the source), nothing in it but `dist`, `LICENSE`, `README.md` and `package.json`, and no ES module that no export points at (code the entries share) exporting a name renamed to a minified one (`globalStyles as D`): such a re-export made Turbopack add a module for each name a binding imports, which put one more script in the first HTML of a Next.js page ([#84](https://github.com/soroush-tech/umber-style/issues/84)), so the packages with shared code build with `minifyInternalExports: false`. It installs all of them together with npm into a temporary folder with `react`, `react-dom` and `vue`, and then checks:

- Every entry and subpath loads with `import` and with `require`, and both give the same names: `@umber-style/cache`, `@umber-style/server/create-instance`, `@umber-style/css/create-instance`, `@umber-style/styled` and the three subpaths of `@umber-style/is-prop-valid` give `default` and the same function by name (`createCache`, `createInstance`, `styled`, `isPropValid`).
- A CommonJS file that loads each of those entries as a bundler's Node interop does (the default is the whole `module.exports`) gets an object as the default, not the function, and gets the function by its name and calls it; TypeScript compiles a CommonJS file that imports them by name.
- Each prop filter answers for its platform (`tabIndex`, `tabindex`, `testID` true, `variant` false), and `@umber-style/is-prop-valid` alone does not resolve.
- The `react-server` condition gives the server build of the React binding (`useTheme` and `readTheme`, no `ThemeContext`), and under the `react-native` condition `umber-style/react` is the React Native binding.
- The bindings and the umbrella share one copy of `@umber-style/core`, and only one is installed.
- `@umber-style/css` makes a class whose rule is in its cache, and its `create-instance` makes a class with its own key.
- A styled component renders on the server with a class, and the cache holds its CSS.
- A styled component over a cache of `@umber-style/cache` renders, and `renderStylesToString` of `@umber-style/server` puts its `<style data-umber>` elements first.
- TypeScript resolves the declarations of every entry under `moduleResolution` `bundler` and `node16`, with `skipLibCheck` off, including a styled component with a typed theme.

Node cannot load `react-native`, so the test installs a small stand-in with the two values the binding imports. It removes its temporary folder, unless it is given `--keep`, and needs the network for npm.

## Once per repository

- The `cd-packages` environment (Settings, Environments, Deployment branches) must allow the branches that alphas come from, such as `feat/*` and `fix/*`. With `main` alone, every alpha from a branch is blocked before it starts.
- Each package has a trusted publisher on npm for `soroush-tech/umber-style`, workflow `cd-packages.yml`, environment `cd-packages`.
- A new package under `packages/` appears in the workflow's `package` list after `pnpm gen:publish-options`, which CI and the pre-commit hook check.
- A package's first version on npm becomes `latest` whatever its tag, so a new package gets a real `0.0.0` placeholder, published by hand, before its first prerelease: a staged or pending placeholder is not enough. The workflow refuses a prerelease for a package that has no release on `latest`.
- When `latest` already points at a prerelease, publish `0.0.0` for the package (a plain publish puts it on `latest`), then run the workflow again: a version already on npm is skipped.

## Limits

- The workflow itself has never run: CI does not run it, so a dispatch is the first proof. What is checked before is its pieces: `scripts/prerelease-versions.mjs --dry-run`, the build, and the packed-tarball test.
- The first release of each package is `0.1.0`. The names existed on npm as `0.0.0` placeholders, which `latest` points to until the first stable release.
- Trusted Publishing needs npm CLI 11.5.1 or later and Node 22.14.0 or later, according to the [npm documentation](https://docs.npmjs.com/trusted-publishers). The workflow checks the first and installs the newest 11.x when the one that came with Node is older. The same page names a higher version, 11.21.0, for managing dist-tags with `npm dist-tag`; the workflow does not call that command.
- The packed-tarball test runs the React Native binding against a stand-in, so the types of the real `react-native` are checked only by the workspace typecheck, and the binding has never run in a real app.
- Stable releases could later go through npm's staged publishing. The workflow does not use it.
- The `bench-report` job has not run in GitHub Actions either. Its script and its benchmark files were run on a laptop for past releases as if they had just been published, with the command line of soroush-bench that the action wraps; the action's own report of these files has not been seen.
