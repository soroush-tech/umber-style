---
name: testing
description: How this repository runs tests and coverage - the three tiers of docs/testing.md and where each test goes, the client and server vitest projects of react and styled, the browser tier, the fixture apps and the development-server tier, known failures, the coverage commands, where coverage output lands, and the 100% gate. Use when writing or running tests or coverage here, or verifying 100% on touched files.
metadata:
  internal: true
---

# Testing

[`docs/testing.md`](../../../docs/testing.md) is the reference: the scenarios, the fixtures, what
each tier does not cover. These are the rules.

## Which tier

Put a check in the lowest tier that can see the thing.

| Tier            | Where                                                       | Runner                                 | For                                                                                      |
| --------------- | ----------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1. Unit         | `*.test.ts(x)`, next to the source                          | vitest, jsdom (or Node)                | The text of a rule, class names, what is inserted where. Counted by coverage             |
| 2. Real browser | `*.browser.test.ts(x)` in `packages/core`, `packages/react` | vitest browser mode, headless Chromium | What only the cascade or layout decides: which rule wins, a computed value, a transition |
| 3. End to end   | `e2e/` against the apps in `fixtures/`                      | Playwright Test, headless Chromium     | A built page: first HTML, hydration, navigation, no script, size                         |

- Unit and integration tests are both `*.test.ts(x)`. A file that needs Node instead of jsdom says
  so in its first line: `// @vitest-environment node` (the `*.node.test.ts` and `*.ssr.test.tsx`
  files do).
- `@umber-style/react` and `@umber-style/styled` split their vitest config into two projects:
  `client` (jsdom, every `*.test.ts(x)`) and `server` (Node, the `react-server` condition, only
  `*.server.test.ts(x)`), where `react` resolves to its server build and has no hooks.
- The React Native binding never loads the platform: its one import of `react-native` resolves to
  `vitest.react-native.ts`, a stand-in.
- A fixture app is a private workspace member of `fixtures/`, never a package. The scenarios a
  fixture runs are listed by letter in `e2e/fixtures.ts`; the specs are in `e2e/tests/`.
- A test that documents behaviour the engine does not have yet is a known failure with a reason
  that starts with `KNOWN`: in the `known` map of its fixture in `e2e/fixtures.ts`, or `it.fails`
  in vitest. One that starts to pass fails the run, and the mark is removed.
- The suite runs on each React 19 minor in CI. A test whose truth depends on the React it runs on
  reads `version` from `react` and runs the other versions' assertions with `it.fails` and a name
  that starts with `KNOWN` (`nonce.ssr.test.tsx`); it never skips. After a pin, restore with
  `git checkout package.json pnpm-lock.yaml` and `pnpm install --frozen-lockfile`.

## Commands

| Command                                                                     | Runs                                                                                |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm test`                                                                 | tier 1 in every workspace member with a `test` script (the pre-commit hook runs it) |
| `pnpm test:coverage`                                                        | the same with coverage; fails below 100%                                            |
| `pnpm --filter <name> test:coverage`                                        | one package, by its name (`@umber-style/core`, `umber-style`)                       |
| `pnpm --filter @umber-style/react exec vitest run --project server`         | one vitest project of react or styled                                               |
| `pnpm test:browser`                                                         | tier 2, in `core` and `react` (their `vitest.browser.config.ts`)                    |
| `pnpm test:e2e`                                                             | tier 3, every fixture, each built and served as in production                       |
| `E2E_FIXTURE=next-app pnpm test:e2e`                                        | one fixture (a comma-separated list works)                                          |
| `pnpm test:e2e:dev`                                                         | tier 3 against the development servers of `vike-ssg`, `next-app` and `spa`          |
| `node scripts/use-react.mjs 19.0`, then `pnpm install --no-frozen-lockfile` | the workspace on another React 19 (CI's React axis); `--check` after the install    |
| `pnpm test:scripts`                                                         | the unit tests of `scripts/` (Node's test runner), at 100%                          |

Tiers 2 and 3 need Chromium once: `pnpm --filter @umber-style/core exec playwright install chromium`.
`pnpm test` and `pnpm test:coverage` never open a browser. The development tier edits files of
`fixtures/shared` and `fixtures/next-app` for a moment; if a run is killed, `git checkout` them.

Benchmarks are not tests: `pnpm test` and `pnpm test:coverage` never run them, and they do not
count toward coverage. `pnpm bench` runs the files in `packages/*/bench/`, and the CI gate in
`bench/gate/` is separate (the `ci-cd` skill, `docs/benchmarks.md`).

## Where coverage output lands

Each workspace member writes its own `coverage/` (v8, reporters `text` and `lcov`):

- `packages/<pkg>/coverage/lcov.info` - the file CI uploads to Codecov under the package's flag,
  after prefixing its `SF:` paths with `packages/<pkg>/` (the `ci-cd` skill).
- The `text` reporter prints the per-file table to stdout - read it for the touched files.
- `coverage` is ignored by git.

## The 100% gate

Every package keeps 100% statements, branches, functions and lines, with no coverage-ignore
comment. Each `vitest.config` sets `thresholds: { 100: true }` over `src/**/*.{ts,tsx}`
(`plugins/**/*.js` in `eslint-config`; `react` leaves its `src/**/vitest.*.ts` test helpers out),
so `pnpm test:coverage` exits non-zero below it, locally and in CI's `packages` matrix. The
`bench` workspace keeps the same gate over `bench/src`. Codecov reports; it does not enforce.
The browser tier is outside coverage: a line covered only by a `*.browser.test.ts(x)` is not
covered. Reach 100% with real tests or by removing dead code.
