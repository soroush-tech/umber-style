# Packages

Conventions for everything under `packages/` - the workspace's code. UmberStyle is a styling engine
(`core`) with one thin binding per platform (`react`, `react-native`, `vue`) and an umbrella
(`umber-style`) that re-exports them. Three packages build on `core` with no framework: `css`
(class names with no theme), `cache` (the cache that server-rendering set-ups read and wrap) and
`server` (the CSS of one page as chunks). `is-prop-valid` depends on nothing: one prop filter for each
platform, which the React binding uses as its default. `styled` is a legacy entry for React that gives the
`styled` of `react` as a default export. `eslint-config` is the private lint config they share. Each
folder is its own pnpm package, globbed by `packages/*` in `pnpm-workspace.yaml` and consumed by the
other packages via `workspace:^` (`workspace:*` for a `devDependency`).

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

The folder is the package name without the `@umber-style/` scope: `core`, `cache`, `server`, `css`,
`is-prop-valid`, `react`, `react-native`, `vue`, `styled`. The unscoped package `umber-style` lives in `packages/umber-style`. A private tooling package
follows the same rule (`@umber-style/eslint-config` is `packages/eslint-config`).

```
packages/
  package-name/
    src/
      index.ts            <- single entry: the public API + its exported types
      index.test.ts       <- co-located unit tests (100% coverage - required)
      index.md            <- the sidecar of index.ts: the model of the file (see "Sidecars")
    package.json
    tsconfig.json         <- bundler resolution, noEmit; NOT in the root solution
    .oxlintrc.json        <- extends @umber-style/eslint-config's base (or React layer) + env
    vitest.config.ts      <- v8 coverage, reporter ['text', 'lcov'], 100% thresholds (.js in eslint-config)
    tsdown.config.ts      <- the build of a publishable package
    README.md             <- a short stub: what it is, install, one import example, a link to docs/
    LICENSE               <- publishable packages only
```

Keep the **public API in `index.ts`**; extract internal helpers into sibling modules with co-located
`*.test.ts` once the entry file grows unwieldy - don't pre-split a small, well-factored file. Each
source file, the entry and every sibling module, has its sidecar next to it (`cache.ts`, `cache.test.ts`,
`cache.md`).

---

## Naming & scope

- The engine and the bindings are scoped **`@umber-style/*`**; the umbrella is the unscoped
  **`umber-style`**.
- The folder, the package name and the Codecov flag agree: the flag is the folder name.

---

## Exports

- Internal consumption is **TypeScript source**: `exports: { ".": "./src/index.ts" }`, consumed under
  `moduleResolution: bundler` via `workspace:^`. **No `paths` alias, no build step** for internal use.
- A package whose API is one function may export it as the default export of its entry or of a
  subpath (`@umber-style/cache`, `@umber-style/server/create-instance`,
  `@umber-style/css/create-instance`, `@umber-style/is-prop-valid/react`, `/vue` and `/react-native`, and
  `@umber-style/styled`). An entry with a default export also exports that value by name, the same
  function (`createCache`, `createInstance`, `isPropValid`, `styled`): a library that is an ES module
  package and ships a CommonJS build reaches our CommonJS file through Node's interop, where the default
  is the whole `module.exports`, so it imports by name. `scripts/smoke-packed.mjs` lists these entries in
  `NAMED_DEFAULTS`. A package with no root entry exports only its subpaths
  (`server` has `./create-instance` and no `.`; `is-prop-valid` has `./react`, `./vue` and
  `./react-native`, and no `main`, `module` or `types` either, so that its bare name does not resolve).
- A binding that has a server build adds the `react-server` condition ahead of `default`. The umbrella
  re-exports each binding as a subpath (`umber-style/react`, `umber-style/react-native`,
  `umber-style/vue`).
- Export supporting **types as named** exports next to the values they describe.

---

## Publishing

Every package but `eslint-config` is publishable (`core`, `cache`, `server`, `css`, `is-prop-valid`, `react`,
`react-native`, `vue`, `styled`, `umber-style`); `eslint-config` stays `"private": true` and is never built. Internal-only packages consume source directly. A
publishable package has:

- No `private`; a `description`, `keywords`, `files: ["dist"]`, `license`, `author`, `homepage`,
  `repository` (with `directory`) and `bugs`, and a `LICENSE` file.
- `repository.url` is this repo - `git+https://github.com/soroush-tech/umber-style.git` - and `bugs.url`
  its issues. npm verifies a publish's provenance against `repository.url` and refuses one that names
  another repo.
- Build with **tsdown** (`format: ['esm', 'cjs']`, `dts: true`) -> `dist/`, with `pnpm build` (the root
  script builds every package under `packages/`). tsdown emits declarations via Oxc/Rolldown and does **not** inject the
  deprecated `baseUrl` that breaks `.d.ts`. One entry in the config for each file an export points at:
  `react` has `index` and `index.server` (the `react-server` condition), and `umber-style` has one entry
  for the code of each subpath and one for the declarations of `umber-style/react` (`shared`,
  `shared.server`), because its code and its types come from different files. `react` and
  `react-native` build unbundled so the `'use client'` directive of the module that holds the theme
  context stays on that module.
- An entry whose API is a default export sets **`cjsDefault: false`** (`cache`, `server`, `css`, `is-prop-valid`): the
  CommonJS build then keeps it as `exports.default`, as its declarations (`export default`) say,
  where the default would make the function `module.exports` itself and a typed `require` would not
  match it. `pnpm smoke:packed` checks `default` from `require` and the types under `node16` from a
  CommonJS file.
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
- `@umber-style/core` is a `dependency` of every other publishable package but `styled` and
  `is-prop-valid`, never bundled into them: one engine is shared. `styled` depends on
  `@umber-style/react` alone, which brings the core; `react` depends on `is-prop-valid` too.
- A sibling in `dependencies` or `peerDependencies` is declared **`workspace:^`**, which pnpm
  publishes as `^<the sibling's version>`, so a package can be patched alone and its dependents take
  the patch within their range. `workspace:*` would publish the exact version, and a patch of one
  package would then nest a second copy of it under every dependent that pinned the older one.
  `pnpm smoke:packed` fails on any other form. A `devDependency` on a sibling stays `workspace:*`.
  `csstype` is a dependency of `core` because its declarations name it.
- Keep every export condition of the source exports in `publishConfig.exports`, each split into
  `import` and `require` with their own `types`. The order of the conditions is part of the meaning
  (`react-server` before `react-native` before the default).
- A peer on a **sibling package** (none has one today) follows the same rule, `workspace:^`: pnpm
  freezes it to `^<the sibling's version at publish time>`, which under 1.0.0 holds the minor, so a
  new minor of the sibling needs a release of the package that names it as a peer.
- `prepublishOnly: pnpm build`; verify the tarball with `pnpm pack` before publishing: `pnpm smoke:packed`
  does it for every publishable package (see [Releasing](../docs/releasing.md)).

### Releasing to npm - always via pnpm, never `npm publish`

The `publishConfig` -> `dist` swap above is a **pnpm feature**. `pnpm pack` / `pnpm publish` rewrite the
top-level `exports`/`main`/`module`/`types` to the `dist` targets before packing. **`npm publish` does
not** - it ships the raw `exports: "./src/index.ts"`, but the tarball only contains `dist`, so every
consumer's `import` fails. Release through the `cd-packages.yml` workflow: manual dispatch, a `package`
and a `channel` (`alpha`, `rc`, `stable`), npm Trusted Publishing, and `pnpm publish` underneath, so the
swap is always applied and there is no long-lived token. [Releasing](../docs/releasing.md) has the
channels, the order of the packages and how to verify a published tarball. Every package has
`release-notes/<version>.md`, which the workflow and `pnpm check:release-notes` require.
`pnpm check:versions` fails when the publishable packages do not carry one version, when `CORE_VERSION`
differs from it, or when a sibling is not declared as above; the pre-commit hook, CI and the workflow
(before anything is published) run it.

---

## Testing - 100% coverage, no exceptions

**Every package must have 100% test coverage** (statements, branches, functions, lines), with no
coverage-ignore comments.

- Co-locate `index.test.ts` next to `src/index.ts`; vitest with v8 coverage.
- Every package ships a `vitest.config.ts` (`vitest.config.js` in `eslint-config`) with `coverage.reporter: ['text', 'lcov']` (v8 provider,
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
- **Private** packages carry the `license` field, but get no `LICENSE` copy while they are `private`.

---

## Documentation

Documentation is not kept in a package. It lives once, organised by topic, in [`docs/`](../docs/README.md)
at the repository root, and is written for all platforms together.

- A feature's documentation goes in the page of `docs/` for its topic, written once. A package gets no
  `docs/` folder of its own and no conventions file.
- Every code example in `docs/` is verified against the code: compiled, run, or copied from a passing
  test. A page ends with a "Limits" section for what is not checked or not observed.
- The package `README.md` stays a stub: what the package is, an install line, one import example, and a
  link to `docs/`. Do not document features in it.

### Sidecars

The one kind of writing that does live in a package is the sidecar: every source file has a sibling
`.md` of the same name, written in the same change as the code (`AGENTS.md`, guidelines 7 and 8).
`docs/` is for the people who use the packages; a sidecar is for whoever changes the file.

- **One for each source file:** `src/cache.ts` has `src/cache.md`; `src/styledParts.ts` has
  `src/styledParts.md`. The same holds for a `.tsx` file, and for a script in `scripts/`.
- **What it holds:** what the file is for, the shape of the data it works on, the invariants it keeps,
  what was decided and what was rejected. Not the signatures: the comments in the code say what each
  function does, and a sidecar that repeats them drifts from them.
- **A document and a graph:** it opens with what the file does and why it exists, and it holds a graph
  of the logic as a `mermaid` block: the path of the data through the file, the decisions and what each
  one leads to.
- **It changes with the code:** a commit that changes behaviour and leaves the sidecar describing the old
  behaviour is incomplete. A sidecar that is wrong and cannot be rewritten now is deleted, not left.
- **A change to what a sidecar describes stops and asks:** the behaviour as it is, what it would become
  and why, before it is written, and again after, for the owner to see it work.
- **No sidecar for:** tests and specs (`*.test.ts(x)`, `*.spec.ts(x)`, `*.bench.ts`), generated output
  (`dist/`, `coverage/`, `*.d.ts`), and config (`tsdown.config.ts`, `vitest.config.ts`, set-up files,
  stubs).
- **It is not published:** a package's `files` is `dist` alone, so a sidecar in `src/` never reaches a
  tarball. Do not add `src` to `files`.
- **It follows the rules of the repository:** no library names, ASCII punctuation, and any code in it is
  copied from the file or from a passing test.

---

## Linting & types

- Each package gets a minimal `.oxlintrc.json` extending one of the two configs in
  `packages/eslint-config/` - `.oxlintrc.json` (base) or `.oxlintrc.react.json` - plus its own `env`
  (node, browser). Packages that ship no React (`core`, `vue`) extend the base; the React bindings and
  the umbrella extend the React layer. The React plugins are declared once in `eslint-config`, not per
  package.
- `tsconfig.json` uses bundler resolution and `noEmit`. The packages are typechecked in isolation via
  `pnpm -r typecheck`.
