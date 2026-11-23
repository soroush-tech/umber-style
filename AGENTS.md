# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## Behavioral guidelines

### 1. Think before coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.

### 2. Propose before implementing

**Always present a plan and wait for confirmation before writing code.**

Cover: which files change, what changes in each, why. Then wait for explicit approval.

Exception: self-evident one-liners (typo fix, missing import).

### 3. Simplicity first

**Minimum code that solves the problem. Nothing speculative.**

- No features, abstractions, or error handling beyond what was asked.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 4. Surgical changes

**Touch only what you must. Clean up only your own mess.**

- Don't refactor, reformat, or "improve" adjacent code.
- Remove imports/variables/functions that YOUR changes made unused.
- Match existing style.
- If you notice unrelated dead code, mention it - don't delete it.

### 5. Goal-driven execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals: "Fix the bug" -> "Write a test that reproduces it, then make it pass."

- "Refactor X" -> "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] -> verify: [check]
2. [Step] -> verify: [check]
3. [Step] -> verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

### 6. Test coverage after implementation

**After any implementation, run `pnpm test:coverage` and verify 100% on all touched files.**

### 7. Document the model beside the code

**Every source file has a sibling `.md` of the same name, written in the same change as the
code.**

`cache.ts` -> `cache.md`. `styledParts.ts` -> `styledParts.md`.

- **Explain the model, not the signatures.** What the file is for, the shape of the data it works
  on, the invariants it keeps, what was decided and what was rejected. The doc comments already
  say what each function does; repeating them is how the two drift apart. The comments in the
  code stay governed by the `code-style` skill - the sidecar is the layer above them, for the
  reader who does not yet know the model. The pages in `docs/` are for the people who use the
  packages; the sidecar is for whoever changes the file.
- **A document and a graph.** It opens with what the file does and why it exists, and it holds a
  graph of the logic (a `mermaid` block: the path of the data through the file, the decisions
  and what each one leads to).
- **A commit that changes behaviour and leaves the sidecar describing the old behaviour is
  incomplete**, the same way one that breaks a test is.
- **A wrong sidecar is worse than none.** If the logic has moved on and there is no time to
  rewrite it, delete the sidecar rather than leave it lying.
- **Exempt:** tests and specs (`*.test.ts(x)`, `*.spec.ts(x)`, `*.bench.ts`, everything under
  `e2e/`), generated output (`dist/`, `coverage/`, `*.d.ts`), and config (`tsdown.config.ts`,
  `vitest.config.ts`, `playwright.config.ts`, set-up files, stubs).

### 8. Changing documented behaviour stops and asks

**When a change would alter the logic or behaviour a sidecar describes, say so and wait for user
confirmation - before writing it, and again after.**

Not the wording: the substance. What the code decides, what it guarantees, what a call does.

- Say what the behaviour is now, what it would become, and why.
- Wait for an answer before writing it.
- Once written, wait for verification. Tests passing is not the same as having seen it work.

This is narrower than guideline 2 and bites at a different moment. Guideline 2 covers the plan
agreed up front; this covers behaviour change discovered during the work, where the shape of
the fix turns out to move something that was being relied on.

## Critical conventions

- **Framework-free core:** `@umber-style/core` knows no framework: no React, no Vue, no DOM globals at
  module top level. It holds the engine - tokens as CSS variables, the class cache, theme classes.
  Anything that needs a platform lives in a binding.
- **Bindings are thin:** `@umber-style/react`, `@umber-style/react-native` and `@umber-style/vue` adapt
  the engine to one platform and keep the same names (`styled`, `ThemeProvider`, `useTheme`,
  `StyleSheet`, `useStyle`, `apply`). Logic that two bindings need belongs in core. `umber-style` only
  re-exports; it holds no logic. `@umber-style/css`, `@umber-style/cache` and `@umber-style/server`
  are built on core and know no framework: class names with no theme, the cache that
  server-rendering set-ups read, and the CSS of one page as `data-umber` chunks.
  `@umber-style/is-prop-valid` depends on nothing, not even core: one prop filter for each platform
  (`/react`, `/vue`, `/react-native`, no root entry), which the React binding uses as its default.
- **No library names:** never name another CSS-in-JS library, CSS framework or web framework in code,
  comments, tests, docs or config comments. The platforms (React, React Native, Vue) and
  `@soroush.tech/styled-system` may be named. A dependency name in a `package.json` is one exception.
  The other, asked for by the owner, is the "Benchmark" section of `docs/style-memo.md`, which names
  the two libraries it measures with their versions: keep it, and do not copy those names anywhere else.
- **No inline styles:** the engine never renders a `style` attribute on the web, and nothing in this
  repository puts one on a plain element (`<div style="...">`, `<div style={{...}}>`). The `style`
  prop of a styled component is the engine's own API: it takes sheet entries and objects and merges
  them into a class.
- **SSR-safe:** never touch browser-only APIs at module top level - guard with
  `typeof window !== 'undefined'` or move the access into an effect. The server build of the React
  binding has no hook and no context.
- **No hex in the engine:** values come from the theme a consumer gives; the packages hold no colors
  of their own.
- **Test placement:** co-located next to source. Unit and integration tests are `*.test.ts(x)`
  (vitest). A file that needs another environment says so with a `// @vitest-environment node`
  comment, or uses a `*.server.test.ts(x)` suffix in `@umber-style/react` and `@umber-style/styled` (run with the
  `react-server` condition).
- **Which tier a test belongs in:** the lowest that can see the thing (`docs/testing.md`). Text of a rule, class names, what is inserted: a `*.test.ts(x)` unit test. What a browser's cascade or layout decides (which rule wins, a computed value, a transition): a `*.browser.test.ts(x)` in `core` or `react`, run by `pnpm test:browser`, outside coverage. What a framework does with the engine on a built page (first HTML, hydration, navigation, no script): an end-to-end test in `e2e/` on an app in `fixtures/`, run by `pnpm test:e2e`. A test that documents behaviour the engine does not have yet is marked as a known failure (`known` in `e2e/fixtures.ts`, `it.fails` in vitest) with a reason that starts with KNOWN; one that starts to pass fails the run.
- **Fixtures are not packages:** fixture apps live in `fixtures/`, never in `packages/`: they are not registered with Codecov, not in the package matrix, and need no `LICENSE`.
- **Benchmarks:** every benchmark is a soroush-bench file (`*.bench.ts`, a default-exported config of two cases or more), run in its Docker sandbox. A local benchmark lives next to what it measures, in `packages/<pkg>/bench/`; it measures the built `dist`, loaded by path and typed by `src`, and its cases compare with each other. The shared inputs and the helper that lets a binding's file load built code (`prepareBuiltPackages`) are in `bench/src/` (a workspace package outside `packages/`). `pnpm bench` builds, then runs every local file one after the other (Docker must be running); `pnpm test` never runs them. The CI gate is separate: the files in `bench/gate/` compare the built `dist` with the core of the last release, built in the same job from its git tag (`bench/bin/previous.mjs`, into the ignored `.bench-previous/`); which release is one word in `bench/gate/baseline.ts`, and `pnpm bench:gate` runs it locally. After each release, `cd-packages.yml` runs the same scenarios with every version from npm as a report, not a gate (`bench/report/`, `scripts/bench-report.mjs`; `docs/benchmarks.md`).
- **100% coverage:** every package keeps 100% statements, branches, functions and lines, with no
  coverage-ignore comments. `pnpm test:coverage` fails below it.
- **Lint and format:** `pnpm lint` runs `oxlint --deny-warnings` - any warning fails. Formatting is not
  linted; `oxfmt` owns it, via `pnpm format` and the `format:check` gate in CI.
- **Typography:** ASCII punctuation only (plain hyphen, straight quotes). `pnpm check:typography` and
  the pre-commit hook enforce it.
- **Packages:** everything under `packages/` is a workspace package. `packages/packages.md` is the
  **standard** for packages - read it first, and follow it when creating or changing any package
  (structure, exports, publishing, registration chores). Every package but `eslint-config` is publishable
  (`core`, `cache`, `server`, `css`, `is-prop-valid`, `react`, `react-native`, `vue`, `styled`, `umber-style`) and built with
  tsdown (`pnpm build`); they consume source inside the workspace and `publishConfig` swaps in `dist` only
  when a tarball is made, so release with `pnpm` through the workflow, never `npm publish`. A publishable
  package must declare a license, ship a `LICENSE` file, and have `release-notes/<version>.md`;
  `eslint-config` stays `private`. A sibling in `dependencies` or `peerDependencies` is `workspace:^`
  (published as `^<version>`, so a package can be patched alone); a `devDependency` stays `workspace:*`.
- **Releasing:** `.github/workflows/cd-packages.yml` is dispatched by hand with a `package` and a
  `channel` (`alpha` from a branch whose `ci-ok` passed, `rc` and `stable` from `main`), and publishes by
  npm Trusted Publishing. `package.json` always holds the target version, never a prerelease.
  `docs/releasing.md` is the guide; `pnpm smoke:packed` proves the packed tarballs work from outside the
  workspace and runs in CI.
- **Generated config:** `.codecov.yml`, the "Affected area" lists of the issue forms and the allowlist
  of `label-area.yml` are written by `pnpm gen:publish-options` from the folders under `packages/`.
  Run it after adding or removing a package; the pre-commit hook and CI run it with `--check`.
- **Documentation:** all documentation lives in `docs/` at the repository root, organised by topic and
  written once for every platform: `docs/README.md` is the index. A feature's documentation goes
  there, in the page for its topic - never in a package README, which stays a short stub (what the
  package is, an install line, one import example, a link to `docs/`). Every code
  example is verified against the code (compiled, run, or copied from a passing test), and every page
  with limits ends with a "Limits" section that says what is not checked or not observed. The pages
  follow the same rules as the code: no library names, ASCII punctuation only, no inline styles.
- **Issue artifacts:** any epic, task, RFC, bug report, user story, feature request or
  documentation-feedback item you draft - whether as a file or for GitHub - must follow the matching
  template in `.github/ISSUE_TEMPLATE/` (`4.epic.yml`, `6.task.yml`, `3.rfc.yml`, `1.bug_report.yml`,
  `5.user_story.yml`, `2.feature_request.yml`, `7.documentation_feedback.yml`). Use that template's
  exact section headings, order, and title prefix (e.g. `[Epic]`, `[Task]`). Read the template before
  drafting.

## Layer conventions

| Layer            | Folder                                                    | What it covers                                                                              |
| ---------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Engine           | `packages/core`                                           | Tokens, class cache, theme classes, style serialization. No framework                       |
| Bindings         | `packages/react`, `packages/react-native`, `packages/vue` | `styled`, `ThemeProvider`, theme hooks, sheets for one platform; thin over core             |
| Umbrella         | `packages/umber-style`                                    | Re-exports core and the bindings as subpaths. Its tests prove one source runs on every one  |
| Plain layer      | `packages/css`                                            | `css`, `cx`, `keyframes`, `injectGlobal`: class names with no theme and no framework        |
| Cache            | `packages/cache`                                          | `createCache({ key })`: the engine's cache with the members server-rendering set-ups read   |
| Server           | `packages/server`                                         | `/create-instance`: the CSS of one page as chunks and `<style data-umber>` tags             |
| Prop filters     | `packages/is-prop-valid`                                  | `/react`, `/vue`, `/react-native`: whether a prop is one an element takes. No dependency    |
| Legacy entry     | `packages/styled`                                         | The `styled` of `@umber-style/react` as a default export, for code that imports it that way |
| Lint config      | `packages/eslint-config`                                  | Private oxlint base and React layers, shared by every package                               |
| Package standard | `packages/packages.md`                                    | Structure, exports, publishing, 100% coverage, licensing, linting                           |
| Releasing        | `docs/releasing.md`, `.github/workflows/cd-packages.yml`  | Channels, the order of the packages, installing a prerelease, verifying a tarball           |
| Documentation    | `docs/`                                                   | One set of pages by topic for every platform, written once; the index is `docs/README.md`   |

## Quick checklist before pushing

1. `pnpm format:check`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test:coverage` - verify 100% on all touched files
5. `pnpm build` - and `pnpm smoke:packed` when a package's exports, build or dependencies changed
