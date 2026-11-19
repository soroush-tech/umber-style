# Releasing

After this page you can publish the five packages to npm, try a change in a real app before it reaches everyone, install a prerelease as a consumer, and check that what npm holds is what you meant to ship.

The packages are `@umber-style/core`, `@umber-style/react`, `@umber-style/react-native`, `@umber-style/vue` and `umber-style`. They are published by one workflow, by hand, never from a push or a merge.

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

1. `@umber-style/core`
2. `@umber-style/react`, `@umber-style/react-native`, `@umber-style/vue`
3. `umber-style`

`all` orders itself. With a named package, publish its dependencies first: a prerelease run points each dependency that is not in the run at its newest version on the same channel, and stops with a message to publish that dependency first when there is none. A stable run stops the same way when the version of a dependency is not on npm. The dependencies are exact: `umber-style@0.1.0` depends on `@umber-style/core@0.1.0`, so one engine is shared by every package.

The run does these things, in this order, and stops at the first one that fails:

1. Checks the branch, and for an alpha that `ci-ok` passed on the commit.
2. Checks that every package of the run has release notes for its target version.
3. Installs, makes sure the npm CLI can publish with Trusted Publishing, and sets the channel's versions.
4. Builds the packages and runs the packed-tarball test on those versions. Nothing has reached npm yet.
5. Publishes each package with `pnpm publish` under the channel's tag. A package that fails stops the run, because the ones after it depend on it; run it again and what is already on npm is skipped.
6. For `rc` and `stable`, creates a GitHub Release for each package, tagged `<name>@<version>`, with the notes file as its body, and does nothing when the release exists. An rc is a pre-release and is never marked latest.

Publishing uses npm Trusted Publishing: the run gets a short-lived token from GitHub and npm verifies it against the trusted publisher of each package (organization `soroush-tech`, repository `umber-style`, workflow `cd-packages.yml`, environment `cd-packages`). There is no npm token in the repository.

## Install a prerelease

A consumer never gets a prerelease by accident: `^0.1.0` and `@latest` skip them. An app opts in by tag or by exact version:

```sh
pnpm add @umber-style/react@alpha @umber-style/core@alpha
pnpm add @umber-style/react@rc
pnpm add @umber-style/react@0.1.0-alpha.2
```

Install the packages of one family on the same tag: they depend on each other by exact version. Something wrong: fix it, push, wait for green CI, dispatch again, and the next `alpha.N` follows. To move an app to the release, change the tag to `^0.1.0`.

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

`pnpm smoke:packed` (`scripts/smoke-packed.mjs`) does the same check before a release, from outside the workspace. It packs the five packages with `pnpm pack`, inspects each tarball, installs all five together with npm into a temporary folder with `react`, `react-dom` and `vue`, and then checks:

- Every entry and subpath loads with `import` and with `require`, and both give the same names.
- The `react-server` condition gives the server build of the React binding (`readTheme`, no `useTheme`), and under the `react-native` condition `umber-style/react` is the React Native binding.
- The bindings and the umbrella share one copy of `@umber-style/core`.
- A styled component renders on the server with a class, and the cache holds its CSS.
- TypeScript resolves the declarations of every entry under `moduleResolution` `bundler` and `node16`, with `skipLibCheck` off, including a styled component with a typed theme.

Node cannot load `react-native`, so the test installs a small stand-in with the two values the binding imports. It removes its temporary folder, unless it is given `--keep`, and needs the network for npm.

## Once per repository

- The `cd-packages` environment (Settings, Environments, Deployment branches) must allow the branches that alphas come from, such as `feat/*` and `fix/*`. With `main` alone, every alpha from a branch is blocked before it starts.
- Each package has a trusted publisher on npm for `soroush-tech/umber-style`, workflow `cd-packages.yml`, environment `cd-packages`.
- A new package under `packages/` appears in the workflow's `package` list after `pnpm gen:publish-options`, which CI and the pre-commit hook check.

## Limits

- The workflow itself has never run: CI does not run it, so a dispatch is the first proof. What is checked before is its pieces: `scripts/prerelease-versions.mjs --dry-run`, the build, and the packed-tarball test.
- The first release of each package is `0.1.0`. The names existed on npm as `0.0.0` placeholders, which `latest` points to until the first stable release.
- Trusted Publishing needs npm CLI 11.5.1 or later and Node 22.14.0 or later, according to the [npm documentation](https://docs.npmjs.com/trusted-publishers). The workflow checks the first and installs the newest 11.x when the one that came with Node is older. The same page names a higher version, 11.21.0, for managing dist-tags with `npm dist-tag`; the workflow does not call that command.
- The packed-tarball test runs the React Native binding against a stand-in, so the types of the real `react-native` are checked only by the workspace typecheck, and the binding has never run in a real app.
- Stable releases could later go through npm's staged publishing. The workflow does not use it.
