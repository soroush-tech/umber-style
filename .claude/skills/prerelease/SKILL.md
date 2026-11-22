---
name: prerelease
description: How to ship the packages of this repository (@umber-style/* and umber-style) through alpha, rc and stable on npm with the `channel` input of CD - Packages (npm), so a change is tried in a real app before it reaches `latest`. Use when releasing a package, publishing an alpha or release candidate from a branch, promoting to stable, or pointing a consumer app at a prerelease.
paths: 'packages/**'
metadata:
  internal: true
---

# Prerelease channel: alpha -> rc -> stable

A release that changes behaviour or API goes alpha -> rc -> stable. Only a maintenance or
documentation-only patch may go straight to stable. [`docs/releasing.md`](../../../docs/releasing.md)
is the guide; these are the rules.

`package.json` always holds the **target** version (`0.1.0`), never a prerelease. The workflow
(`scripts/prerelease-versions.mjs`) turns the target into the published version in its own
checkout and commits nothing:

| channel  | Published as    | npm dist-tag | Run from                        | GitHub Release |
| -------- | --------------- | ------------ | ------------------------------- | -------------- |
| `alpha`  | `X.Y.Z-alpha.N` | `alpha`      | any branch whose `ci-ok` passed | none           |
| `rc`     | `X.Y.Z-rc.N`    | `rc`         | `main`                          | pre-release    |
| `stable` | `X.Y.Z`         | `latest`     | `main`                          | release        |

`N` is one above the highest `X.Y.Z-<channel>.N` already on npm, `0` when there is none. Nobody
edits it.

## Rules

- Pick the target by semver (the `release-notes` skill) and set `package.json` to it once, before
  the first alpha. It stays there through every alpha and rc.

  ```jsonc
  // Bad - a prerelease in package.json: the workflow refuses it on every channel
  "version": "0.2.0-alpha.1"
  // Good - the target; the dispatch adds the suffix
  "version": "0.2.0"
  ```

- One notes file per target: `packages/<dir>/release-notes/X.Y.Z.md`, never one per alpha or rc.
  It must exist from the first alpha (the workflow checks the target's file on every channel), and
  it grows as the alphas go. An rc's GitHub pre-release shows it, so it is complete before the
  first rc.
- A prerelease never lands on `latest`: the workflow publishes with `--tag <channel>` and fails the
  run if `latest` ever points at a prerelease. That is also why `pnpm check:release-notes` keeps
  passing during prereleases: it compares `package.json` with `latest` only.
- A target already released cannot get a prerelease: a named package fails, `all` skips it.
- Consumers never get a prerelease by accident: `^0.1.0` and `@latest` skip prereleases. An app
  opts in by tag or exact version.

## Dependencies first

A sibling in `dependencies` or `peerDependencies` is `workspace:^`, which pnpm publishes as
`^<the sibling's version>`: `umber-style@0.2.0` depends on `@umber-style/core` `^0.2.0`. Up to 0.1.0
it was `workspace:*`, an exact version, so a patch released alone nested a second copy of the
package under every dependent that pinned the older one; from 0.2.0 a package can be patched alone.
A `devDependency` on a sibling stays `workspace:*`, and `pnpm smoke:packed` fails on any other form
(`docs/releasing.md`). A prerelease publishes `^X.Y.Z-<channel>.N`, which takes the later
prereleases of the same version and its release. The order, from each `package.json`'s
`dependencies`:

1. `core` and `is-prop-valid`, which depend on no sibling
2. `cache`, `css`, `server`, `react-native`, `vue` - each depends on `core` alone (`server` uses
   `cache`, `css` and `react` in its tests only) - and `react` (`core` and `is-prop-valid`)
3. `styled` (depends on `react`) and `umber-style` (depends on `core`, `react`, `react-native`,
   `vue`)

`all` orders the run itself. With a named package, a prerelease run points each workspace
dependency that is not in the run at its newest prerelease on the same channel (or its target, when
that is already released), and stops with "publish <dir> first" when there is none. A stable run
stops the same way when the dependency's version is not on npm.

## Publish an alpha (try a pull request before it merges)

1. Set the target in `package.json` on the feature branch (once) and add its notes file; commit.
   The owner pushes and opens the pull request.
2. Wait for CI: `ci-ok` must be green on the branch's latest commit.
3. The owner dispatches **CD - Packages (npm)**: _Use workflow from_ the branch, `package`
   (dependencies first, or `all`), `channel: alpha`.
4. In the consumer app, install the family on one tag:
   `pnpm add @umber-style/react@alpha @umber-style/core@alpha`.
5. Something wrong: fix, push, wait for green CI, dispatch again - the next `alpha.N` follows.

## Publish a release candidate

1. Merge the pull request (the target and `release-notes/X.Y.Z.md` in it).
2. Dispatch from `main` with `channel: rc`, dependencies first.
3. Consumers: `pnpm add @umber-style/react@rc`. A fix is a pull request to `main`, then another rc.

## Promote to stable

1. Dispatch from `main` with `channel: stable`, dependencies first - same `package.json`, no commit
   needed.
2. `npm view @umber-style/<pkg> dist-tags`: `latest` is `X.Y.Z`.
3. Consumers move from the tag to `^X.Y.Z`. The next change needs a new target.
4. `pnpm deprecate-alpha`: deprecates every alpha whose release is now on npm, in every package,
   pointing each at `^X.Y.Z`. It asks for npm's one-time code; `--dry-run` only lists.
5. After the first stable release, `BASELINE_TAG` in `bench/gate/baseline.ts` changes from
   `'alpha'` to `'latest'`, so the benchmark gate compares against the release.

## Once per repository

- The `cd-packages` environment (Settings, Environments, Deployment branches) must allow the
  branches alphas come from (`feat/*`, `fix/*`, ...); with `main` alone every alpha from a branch is
  blocked before it starts.
- Each package has a trusted publisher on npm: `soroush-tech/umber-style`, workflow
  `cd-packages.yml`, environment `cd-packages`.
- A new package appears in the workflow's `package` list after `pnpm gen:publish-options`.
