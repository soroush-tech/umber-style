---
name: ci-cd
description: GitHub Actions conventions of this repository - the one CI workflow (prepare, lint, then packages, build, browser, e2e, e2e-dev and bench, then ci-ok), the composite setup action, how actions are pinned, per-package Codecov flags uploaded by OIDC, the benchmark gate with soroush-bench, the blocks that pnpm gen:publish-options writes, and publishing by hand through cd-packages.yml. Use when adding, editing or debugging anything under .github/workflows/ or .github/actions/.
paths: '.github/workflows/**,.github/actions/**'
metadata:
  internal: true
---

# CI/CD (GitHub Actions)

## Workflow files

| File              | Name                  | Trigger                                    |
| ----------------- | --------------------- | ------------------------------------------ |
| `ci.yml`          | `CI`                  | `push` to `main`, every `pull_request`     |
| `cd-packages.yml` | `CD - Packages (npm)` | `workflow_dispatch` only, by hand          |
| `label-area.yml`  | `Label Affected Area` | `issues: opened` (labels the issue's area) |

One CI workflow holds every job. CD is separate and manual: a release is a deliberate act with
notes written in the repository, never triggered by a push or a merge.

## Action pinning

Pin every `uses:` by the action's origin, as the files do:

- **GitHub's own** (`actions/*`: `checkout`, `setup-node`, `cache/restore`, `cache/save`,
  `github-script`, `create-github-app-token`) - a major version tag: `actions/checkout@v7`.
- **Everything else, the owner's own actions included** (`pnpm/action-setup`,
  `codecov/codecov-action`, `soroush-tech/bench-action`) - a full commit SHA with the version in a
  comment: `soroush-tech/bench-action@ab812be... # v1.3.0`. A tag can be moved, the owner's tags
  too. Bumping the SHA is a reviewed line.

## CI job shape

`prepare` -> `lint` -> `packages` (matrix), `build`, `browser` (matrix), `e2e` (matrix),
`e2e-dev` (matrix), `bench` -> `ci-ok`.

- **`prepare` detects once** and the other jobs read `needs.prepare.outputs.*`: the Node version
  from `.nvmrc` (never hard-coded), the package manager and its install command, the package
  matrix, the Playwright version (for the browser cache key), the fixture matrix, and the React
  axis (the minors of the event, `newest`, and one matrix per React-using job).
- **The React axis**: `REACT_MINORS` in the `env` of `prepare` lists the React 19 minors, oldest
  first (`19.0` to `19.3`); it is the one place to add a minor. `prepare` turns it into the minors of
  the event: the oldest and the newest on a `pull_request`, every one on a `push` to `main` (the `react`
  step's `minors` and `newest` outputs, which only `prepare` reads). The axis is a row's only where React is
  used: the step "Discover the matrices" makes the matrices of `packages`, `browser`, `e2e` and `e2e-dev`
  from the files (outputs `packages`, `browser`, `fixtures`, `fixtures_dev`), and a package or fixture whose
  `package.json` lists `react` in its dependencies, peerDependencies or devDependencies has a row for each
  minor, the others one row with `react: ''`. An App Router fixture (`next` and an `app` folder) runs the React
  that Next.js bundles, so it has no React row and says so in its name. Each row carries a `label` that its job name
  appends (`, react 19.0`) and `coverage`, true on the newest minor of a package per minor and on the only row
  of any other. A row gives `react: ${{ matrix.react }}` to the setup action, which pins the newest patch of the
  minor (`scripts/use-react.mjs`, a root `pnpm.overrides` in the checkout only), installs with
  `--no-frozen-lockfile`, and checks the installed copies; an empty `react` installs the lockfile's React, as
  `lint`, `build` and `bench` do.
- **The Next.js axis**: `NEXT_MINORS` in the `env` of `prepare` lists the Next.js 16 minors that the `e2e` and
  `e2e-dev` rows of `next-app` run on: the lowest of the peer range of `@umber-style/react/next` first, the
  newest last (`16.3`, `16.4`). A `pull_request` runs the newest only, a `push` to `main` both (the `next` step's
  `minors` output). Only the fixtures in `nextFixtures` of the discovery script (`next-app`) get the axis, one row
  for each minor (`, next 16.4, runs the React of Next.js`); any other App Router fixture (`next-ppr`) runs once.
  A row gives `next: ${{ matrix.next }}` to the setup action, which pins the newest patch of the minor
  (`scripts/use-next.mjs`, a root `pnpm.overrides`), installs with `--no-frozen-lockfile` and checks the installed
  copies. When the peer range is raised, replace the first minor; when Next.js releases a new minor, replace the
  last.
- **The package matrix is discovered from `packages/`**: a row per folder with a `package.json`
  (see the axis above), with `dir`, `filter` (the package name) and `flag` (the folder name). Adding
  a package needs no edit to `ci.yml`. The same holds for `e2e`: rows for each folder of `fixtures/` except
  `shared`, and for `browser`: the packages with a `test:browser` script.
- **Two lists are written out**, in the discovery script of `prepare`: the fixtures of `e2e-dev` (`vike-ssg`,
  `next-app`, `next-ppr`, `spa`: the ones with a `devPort` in `e2e/fixtures.ts`), and the fixtures of the Next.js
  axis (`next-app`). A new fixture with a development server is added to the first by hand.
- **`lint`** runs `format:check`, `lint`, `typecheck`, `test:scripts` (Node's test runner on
  `scripts/*.test.mjs`, at 100%), `gen:publish-options --check`, `check:typography` and
  `check:release-notes`, `check:versions` (one version for the family, `CORE_VERSION` equal to it, siblings
  `workspace:^`; `cd-packages.yml` runs it too, before the versions of the run are written), once for the
  whole workspace.
- **`packages`** runs one package's tests on one React where the package uses it: `test:coverage` and
  the lcov upload on the row with `coverage`, `test` on the others. **`build`** runs once, on the
  lockfile's React (the typecheck reads `@types/react`, which the pin leaves alone; the build leaves React
  external; `scripts/smoke-packed.mjs`, the packed tarballs installed from outside the workspace, installs
  its own React): `pnpm typecheck`, `pnpm build` and the smoke test. **`browser`**, **`e2e`** and **`e2e-dev`** restore the Playwright binaries from the
  cache, install Chromium on a miss and its system libraries on a hit (three attempts of three
  minutes), and run `test:browser`, `test:e2e` or `test:e2e:dev`.
- **Every job that installs uses `./.github/actions/setup`**, the composite action that holds
  pnpm, Node and the install. Never inline those steps again: the `pnpm/action-setup` pin and the
  store cache stay a one-file edit. A job is a checkout (a local action cannot carry it - it is
  resolved from the working tree the checkout makes) plus a call with `node_version`, `manager`
  and `command`. Per-job caches (the Playwright binaries) stay in the job, after the call.
- **Every install runs `--ignore-scripts`**: no lifecycle script at install time, in CI or CD. The
  packages build with tsdown, which needs none.
- **Checkouts use `persist-credentials: false`**. A dispatch input or an action input reaches a
  `run:` script through `env:`, never spliced into it (`cd-packages.yml`, the setup action).
- **`ci-ok`** is the one required check (the matrix jobs' names carry their row, so none of them is
  required by name): `if: always()`, it fails when a needed job failed or was
  cancelled. **Add every new job to its `needs`.**
- Every job sets `timeout-minutes` and its `permissions`; matrices use `fail-fast: false`. CI
  cancels a superseded run; CD never does (`cancel-in-progress: false`).

## The benchmark gate (`bench`)

`bench` builds the packages (the `current` side), then `node bench/bin/previous.mjs` builds the
`previous` side: it picks the tag of the last release of `@umber-style/core` (`BASELINE_RELEASE` in
`bench/gate/baseline.ts`: `'stable'`, or `'newest'` to take a release candidate too), fetches that one
commit by the repository's public address into the shallow clone, extracts its tree into
`.bench-previous/` (inside the checkout, because the sandbox mounts only the checkout; git ignores
it), and builds the core there with that release's lockfile. Then `soroush-tech/bench-action`
(soroush-bench, `@soroush.tech/bench`) runs the `*.bench.ts` files of `bench/gate/` in a Docker
sandbox pinned to one CPU and 512 MB; each loads both builds by path. With the baseline case `previous`, a
minimum ratio of 80 and 5 rounds (`GATE_OPTIONS` of `bench/gate/baseline.ts`, which a step prints with
`node bench/bin/gate-options.mjs` into `$GITHUB_OUTPUT` for the action, and `pnpm bench:gate` reads too:
change them there, never in the workflow), a case slower than the release by more than a fifth fails the
job and, through `ci-ok`, the pull request. A previous build that cannot be made fails the step before
the gate: the gate never passes without a comparison. `pnpm bench:gate` (`bench/bin/gate.mjs`) runs the
same on a machine. The job posts one comment on the pull request (bench-action 1.3.0, which vendors
soroush-bench 2.4.0: a summary table across the files, failures first, each file's table folded under it,
and a line under the head that names the bench version, Node version and sandbox limits;
`comment-title` and `comment-details` stay at their defaults, as there is one bench job), as the org's
GitHub App when the `BENCH_BOT_APP_ID` variable is set, else with `GITHUB_TOKEN`. The action writes the
same report to the job summary. A file that ran but left no results fails the job too. Details and how
to read a failure: `docs/benchmarks.md`.

## The benchmark report after a release (`bench-report` in `cd-packages.yml`)

After `publish`, whose output `published` lists the `<name>@<version>` it published, `bench-report`
runs three steps:

1. `node scripts/bench-report.mjs plan`: waits (30 tries, 10 seconds apart) until the registry lists
   each version, picks what to compare with `planReport` (`bench/src/releases.ts`: the last stable, and
   for an alpha or an rc the previous one of its channel for the same version), writes the versions into
   `bench/report/versions.json`, and gives the step the outputs `spec` and `baseline-case` (the last
   stable, else the previous of the channel). A first release gets neither, and the next steps skip.
2. `soroush-tech/bench-action` (the same pin as the gate) on `bench/report/` in report-only mode:
   `min-ratio: ''` (no gate; a file that crashed or left no results still fails the step),
   `rounds: '5'`, `github-token: ''` (no comment), `comment-title` naming the spec. Every version is
   installed from npm in the sandbox; the ratios are soroush-bench's. The action writes the report to
   the job summary and gives it as its `report` output.
3. For an rc or a stable release, `node scripts/bench-report.mjs append` puts that output below the
   notes of its GitHub Release (`gh release edit`, after a marker that a rerun replaces from).

Only the core has report scenarios, so the action runs once. No ratio is computed in the repository. It
is a report, not a gate: `continue-on-error: true`, and a last step says in the summary when it did not
run to the end. CI never runs it.

## Coverage to Codecov

- Only the row with `coverage` of each package uploads (the newest React of a package per minor, its only row otherwise), so a flag gets one report per run.
- Each `packages` row rewrites `SF:` in `packages/<dir>/coverage/lcov.info` to start with
  `packages/<dir>/` (a lone `src/index.ts` is ambiguous across the monorepo), then uploads it with
  `flags` and `name` set to the folder name and `slug: soroush-tech/umber-style`.
- The upload is tokenless by OIDC (`use_oidc: true`, job permission `id-token: write`): there is no
  `CODECOV_TOKEN` secret.
- `.codecov.yml` gates the patch per flag, carries a flag's last report forward when it did not
  upload, and gives each package a component with a project status off `main`.
- 100% is enforced by each package's `vitest.config` (`thresholds: { 100: true }`); Codecov
  reports only.

## Generated blocks - never edit by hand

`pnpm gen:publish-options` (`scripts/gen-publish-options.mjs`) writes, from the folders of
`packages/`:

- the `package` choice list of `cd-packages.yml` (`all` and the non-private packages),
- the patch flags, flags and components of `.codecov.yml` (every package),
- the "Affected area" dropdown of every issue form in `.github/ISSUE_TEMPLATE/` and the allowlist
  of `label-area.yml` (every package).

Each block sits between `# gen:... start` and `# gen:... end` comments. The pre-commit hook and the
`lint` job run it with `--check`, so drift fails. After adding or removing a package, run it and
commit the result.

## Publishing (`cd-packages.yml`)

Dispatched by hand with a `package` (one folder or `all`) and a `channel` (`alpha`, `rc`,
`stable`; the `prerelease` skill). In the `cd-packages` environment, one job:

1. Checks the branch: `rc` and `stable` from `main` only; an `alpha` from any branch whose commit
   has a green `ci-ok`.
2. Resolves the packages and refuses to go on when one has no
   `packages/<dir>/release-notes/<version>.md`.
3. Installs through the setup action with npm's registry, and makes sure the npm CLI is 11.5.1 or
   later, which Trusted Publishing needs.
4. `scripts/prerelease-versions.mjs` sets the channel's versions in the checkout and orders the
   run dependencies first.
5. `pnpm build` and the packed-tarball test, before anything reaches npm.
6. `pnpm publish --tag <channel>` (`latest` for stable) for each package, skipping a version already
   on npm; the run fails if `latest` ever points at a prerelease.
7. For `rc` and `stable`, a GitHub Release `<name>@<version>` with the notes file as its body,
   created only when missing, so a rerun repairs it.

Publishing is npm Trusted Publishing: an OIDC token per run (`id-token: write`), verified by npm
against the trusted publisher of each package. There is no `NPM_TOKEN`, and `NODE_AUTH_TOKEN` must
stay unset. Never `npm publish`: only `pnpm publish` swaps in the `dist` exports of
`publishConfig`. CI never runs this workflow; the owner dispatches it.
