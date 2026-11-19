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

## Critical conventions

- **Framework-free core:** `@umber-style/core` knows no framework: no React, no Vue, no DOM globals at
  module top level. It holds the engine - tokens as CSS variables, the class cache, theme classes.
  Anything that needs a platform lives in a binding.
- **Bindings are thin:** `@umber-style/react`, `@umber-style/react-native` and `@umber-style/vue` adapt
  the engine to one platform and keep the same names (`styled`, `ThemeProvider`, `useTheme`,
  `StyleSheet`, `useStyle`, `apply`). Logic that two bindings need belongs in core. `umber-style` only
  re-exports; it holds no logic.
- **No library names:** never name another CSS-in-JS library, CSS framework or web framework in code,
  comments, tests, docs or config comments. The platforms (React, React Native, Vue) and
  `@soroush.tech/styled-system` may be named. A dependency name in a `package.json` is the one
  exception.
- **No inline styles:** the engine never renders a `style` attribute on the web, and nothing in this
  repository writes one (`style="..."`, `style={{...}}`). Style through the engine: the `style` prop of
  a styled component takes sheet entries and objects and merges them into a class.
- **SSR-safe:** never touch browser-only APIs at module top level - guard with
  `typeof window !== 'undefined'` or move the access into an effect. The server build of the React
  binding has no hook and no context.
- **No hex in the engine:** values come from the theme a consumer gives; the packages hold no colors
  of their own.
- **Test placement:** co-located next to source. Unit and integration tests are `*.test.ts(x)`
  (vitest). A file that needs another environment says so with a `// @vitest-environment node`
  comment, or uses a `*.server.test.ts(x)` suffix in `@umber-style/react` (run with the `react-server`
  condition).
- **Which tier a test belongs in:** the lowest that can see the thing (`docs/testing.md`). Text of a rule, class names, what is inserted: a `*.test.ts(x)` unit test. What a browser's cascade or layout decides (which rule wins, a computed value, a transition): a `*.browser.test.ts(x)` in `core` or `react`, run by `pnpm test:browser`, outside coverage. What a framework does with the engine on a built page (first HTML, hydration, navigation, no script): an end-to-end test in `e2e/` on an app in `fixtures/`, run by `pnpm test:e2e`. A test that documents behaviour the engine does not have yet is marked as a known failure (`known` in `e2e/fixtures.ts`, `it.fails` in vitest) with a reason that starts with KNOWN; one that starts to pass fails the run.
- **Fixtures are not packages:** fixture apps live in `fixtures/`, never in `packages/`: they are not registered with Codecov, not in the package matrix, and need no `LICENSE`.
- **Benchmarks:** a benchmark lives next to what it measures, in `packages/<pkg>/bench/*.bench.ts(x)`; the helpers, the runner and `bench:compare` are in `bench/` (a workspace package outside `packages/`). `pnpm bench` runs them all, `pnpm bench:compare <a.json> <b.json>` compares two runs, and `pnpm test` never runs them (`docs/benchmarks.md`).
- **100% coverage:** every package keeps 100% statements, branches, functions and lines, with no
  coverage-ignore comments. `pnpm test:coverage` fails below it.
- **Lint and format:** `pnpm lint` runs `oxlint --deny-warnings` - any warning fails. Formatting is not
  linted; `oxfmt` owns it, via `pnpm format` and the `format:check` gate in CI.
- **Typography:** ASCII punctuation only (plain hyphen, straight quotes). `pnpm check:typography` and
  the pre-commit hook enforce it.
- **Packages:** everything under `packages/` is a workspace package. `packages/packages.md` is the
  **standard** for packages - read it first, and follow it when creating or changing any package
  (structure, exports, publishing, registration chores). Every package is `private` until it is
  published; a publishable package must declare a license and ship a `LICENSE` file.
- **Generated config:** `.codecov.yml`, the "Affected area" lists of the issue forms and the allowlist
  of `label-area.yml` are written by `pnpm gen:publish-options` from the folders under `packages/`.
  Run it after adding or removing a package; the pre-commit hook and CI run it with `--check`.
- **Documentation:** all documentation lives in `docs/` at the repository root, organised by topic and
  written once for every platform: `docs/README.md` is the index. A feature's documentation goes
  there, in the page for its topic - never in a package README, which stays a short stub (what the
  package is, a not-yet-published install line, one import example, a link to `docs/`). Every code
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

| Layer            | Folder                                                    | What it covers                                                                             |
| ---------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Engine           | `packages/core`                                           | Tokens, class cache, theme classes, style serialization. No framework                      |
| Bindings         | `packages/react`, `packages/react-native`, `packages/vue` | `styled`, `ThemeProvider`, theme hooks, sheets for one platform; thin over core            |
| Umbrella         | `packages/umber-style`                                    | Re-exports core and the bindings as subpaths. Its tests prove one source runs on every one |
| Lint config      | `packages/eslint-config`                                  | Private oxlint base and React layers, shared by every package                              |
| Package standard | `packages/packages.md`                                    | Structure, exports, publishing, 100% coverage, licensing, linting                          |
| Documentation    | `docs/`                                                   | One set of pages by topic for every platform, written once; the index is `docs/README.md`  |

## Quick checklist before pushing

1. `pnpm format:check`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test:coverage` - verify 100% on all touched files
