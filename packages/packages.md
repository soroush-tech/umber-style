# Packages

Conventions for everything under `packages/` - the workspace's code. UmberStyle is a styling engine
(`core`) with one thin binding per platform (`react`, `react-native`, `vue`) and an umbrella
(`umber-style`) that re-exports them. `eslint-config` is the private lint config they share. Each
folder is its own pnpm package, globbed by `packages/*` in `pnpm-workspace.yaml` and consumed by the
other packages via `workspace:*`.

---

## What belongs here

A package is justified only when it is (a) reused by more than one member, or (b) intended to be
published on its own. Until then, keep the code where it is used - don't pre-extract.

- `core` has no framework in it. A binding that needs logic a second binding also needs moves that
  logic into `core`.
- A binding is thin: it adapts the engine to one platform and keeps the shared names.
- The umbrella holds no logic, only re-exports and the tests that prove the bindings agree.

---

## Folder structure

The folder is the package name without the `@umber-style/` scope: `core`, `react`, `react-native`,
`vue`. The unscoped package `umber-style` lives in `packages/umber-style`. A private tooling package
follows the same rule (`@umber-style/eslint-config` is `packages/eslint-config`).

```
packages/
  package-name/
    src/
      index.ts            <- single entry: the public API + its exported types
      index.test.ts       <- co-located unit tests (100% coverage - required)
    package.json
    tsconfig.json         <- bundler resolution, noEmit; NOT in the root solution
    .oxlintrc.json        <- extends @umber-style/eslint-config's base (or React layer) + env
    vitest.config.ts      <- v8 coverage, reporter ['text', 'lcov'], 100% thresholds
    tsdown.config.ts      <- publishable packages only
    README.md             <- a short stub: what it is, install, one import example, a link to docs/
    LICENSE               <- publishable packages only
```

Keep the **public API in `index.ts`**; extract internal helpers into sibling modules with co-located
`*.test.ts` once the entry file grows unwieldy - don't pre-split a small, well-factored file.

---

## Naming & scope

- The engine and the bindings are scoped **`@umber-style/*`**; the umbrella is the unscoped
  **`umber-style`**.
- The folder, the package name and the Codecov flag agree: the flag is the folder name.

---

## Exports

- Internal consumption is **TypeScript source**: `exports: { ".": "./src/index.ts" }`, consumed under
  `moduleResolution: bundler` via `workspace:*`. **No `paths` alias, no build step** for internal use.
- A binding that has a server build adds the `react-server` condition ahead of `default`. The umbrella
  re-exports each binding as a subpath (`umber-style/react`, `umber-style/react-native`,
  `umber-style/vue`).
- Export supporting **types as named** exports next to the values they describe.

---

## Publishing

Every package is `"private": true` at version `0.1.0` until it is published; none is published yet.
Internal-only packages consume source directly. To make a package publishable:

- Drop `private`; add `description`, `keywords`, `files: ["dist"]`. `license`, `author`, `homepage`,
  `repository` (with `directory`) and `bugs` are already in every package.
- `repository.url` is this repo - `git+https://github.com/soroush-tech/umber-style.git` - and `bugs.url`
  its issues. npm verifies a publish's provenance against `repository.url` and refuses one that names
  another repo.
- Build with **tsdown** (`format: ['esm', 'cjs']`, `dts: true`) -> `dist/`. tsdown emits declarations
  via Oxc/Rolldown and does **not** inject the deprecated `baseUrl` that breaks `.d.ts`.
- Keep `exports -> ./src/index.ts` for the workspace, and use **`publishConfig`** to swap
  `exports`/`main`/`module`/`types` to `dist/` **only on publish** - so the workspace keeps consuming
  source while npm gets compiled output:

  ```jsonc
  "exports": { ".": "./src/index.ts" },
  "publishConfig": {
    "access": "public",
    "exports": { ".": { "import": { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
                        "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" } } },
    "main": "./dist/index.cjs", "module": "./dist/index.mjs", "types": "./dist/index.d.mts"
  }
  ```

- Declare the host framework as a **`peerDependency`** (`react`, `react-native`, `vue`); never bundle
  the peer. `react-native` is an optional peer of its binding.
- A peer on a **sibling package** is an explicit range covering every major it supports, widened
  deliberately when a new major lands, never `workspace:^`: pnpm freezes `workspace:^` to
  `^<the sibling's version at publish time>`. The `devDependency` stays `workspace:*`.
- `prepublishOnly: pnpm build`; verify the tarball with `pnpm pack` before publishing.

### Releasing to npm - always via pnpm, never `npm publish`

The `publishConfig` -> `dist` swap above is a **pnpm feature**. `pnpm pack` / `pnpm publish` rewrite the
top-level `exports`/`main`/`module`/`types` to the `dist` targets before packing. **`npm publish` does
not** - it ships the raw `exports: "./src/index.ts"`, but the tarball only contains `dist`, so every
consumer's `import` fails. Publish from the repo root with
`pnpm --filter '<name>' publish --no-git-checks`, and verify the published artifact, not just the
metadata: download the tarball and confirm `exports` resolves to `dist`. A publish workflow does not
exist yet; until it does, nothing is published.

---

## Testing - 100% coverage, no exceptions

**Every package must have 100% test coverage** (statements, branches, functions, lines), with no
coverage-ignore comments.

- Co-locate `index.test.ts` next to `src/index.ts`; vitest with v8 coverage.
- Every package ships a `vitest.config.ts` with `coverage.reporter: ['text', 'lcov']` (v8 provider,
  `thresholds: { 100: true }`). The `lcov` reporter is **required** - CI reads each package's
  `coverage/lcov.info` to rewrite `SF:` paths and upload to Codecov.
- Each package exposes `test` and `test:coverage` scripts; the root aggregates with
  `pnpm -r test:coverage`.
- **Register the package with Codecov** by running `pnpm gen:publish-options`: it regenerates every
  package's flag and component in [`.codecov.yml`](../.codecov.yml), the "Affected area" lists of the
  issue forms and the allowlist of `label-area.yml`. The pre-commit hook and CI run it with `--check`.
  Flag name == component id == directory name.
- **Which tier a test goes in** (see [Testing](../docs/testing.md)): a check of text, names or insertion is a unit test (`*.test.ts(x)`, counted by coverage). A check that only a browser can settle - which rule wins, a computed value, a transition - is a `*.browser.test.ts(x)`, run by the package's `test:browser` script (a `vitest.browser.config.ts` of its own, headless Chromium through Playwright, `playwright` pinned to one exact version across packages) and not counted by coverage. A check of a built app belongs in `e2e/`, against a fixture in `fixtures/`, not in a package.
- Code a test environment cannot run is isolated behind an injectable input or a stand-in: the React
  Native binding's one platform import resolves to `vitest.react-native.ts` in tests.

---

## Licensing

- A **publishable** (non-`private`) package **must** declare a `license` field and ship a `LICENSE`
  file.
- **Private** packages already carry the `license` field, but get no `LICENSE` copy until `private` is
  removed.

---

## Documentation

Documentation is not kept in a package. It lives once, organised by topic, in [`docs/`](../docs/README.md)
at the repository root, and is written for all platforms together.

- A feature's documentation goes in the page of `docs/` for its topic, written once. A package gets no
  `docs/` folder of its own and no conventions file.
- Every code example in `docs/` is verified against the code: compiled, run, or copied from a passing
  test. A page ends with a "Limits" section for what is not checked or not observed.
- The package `README.md` stays a stub: what the package is, an install line marked as not yet
  published, one import example, and a link to `docs/`. Do not document features in it.

---

## Linting & types

- Each package gets a minimal `.oxlintrc.json` extending one of the two configs in
  `packages/eslint-config/` - `.oxlintrc.json` (base) or `.oxlintrc.react.json` - plus its own `env`
  (node, browser). Packages that ship no React (`core`, `vue`) extend the base; the React bindings and
  the umbrella extend the React layer. The React plugins are declared once in `eslint-config`, not per
  package.
- `tsconfig.json` uses bundler resolution and `noEmit`. The packages are typechecked in isolation via
  `pnpm -r typecheck`.
