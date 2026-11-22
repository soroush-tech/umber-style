# Benchmarks

After this page you can run the benchmark suite on your machine, read the table it prints, and tell which figures are steady enough to rely on and which are not.

The suite measures UmberStyle against itself: it has no other library in it. Its purpose is to notice that a change made something slower, and to show where the time of a render goes. Every benchmark is a file for [soroush-bench](https://soroush.tech/bench/) (the package `@soroush.tech/bench`), which runs it in a Docker sandbox pinned to one CPU and 512 MB.

## What is measured

Each benchmark file sits next to what it measures, in `packages/<package>/bench/`, and measures the built `dist` of that package. One operation of each case is described in a comment at the top of its file. The cases of a file compare with each other; a file never compares two versions (that is the gate's job, below).

| Package        | File                            | What it measures                                                                                                                        |
| -------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `core`         | `classes-creation.bench.ts`     | Class creation: a small and a large style the cache has not seen (a miss), and the same or an equal style again (a hit)                 |
| `core`         | `classes-merging.bench.ts`      | Merging two and five classes, and a class with a new style object                                                                       |
| `core`         | `classes-rules.bench.ts`        | A small and a large style object compiled to rules, and the large one merged                                                            |
| `core`         | `extraction.bench.ts`           | `extract()` and `createStyleTag` of a cache with 400 classes, `extractPageStyles` for one page out of ten, and the scan of its HTML     |
| `core`         | `helpers-arithmetic.bench.ts`   | Each arithmetic helper on a token and on a literal                                                                                      |
| `core`         | `helpers-alpha.bench.ts`        | `alpha` on a token and on a literal colour                                                                                              |
| `core`         | `pruning-scan.bench.ts`         | Scanning rules for the variables they use                                                                                               |
| `core`         | `pruning-mark-used.bench.ts`    | A newly used variable added to five theme classes, one that is used already, and the fresh cache the first needs                        |
| `core`         | `sheets-object.bench.ts`        | An object sheet on first and later access, and an entry used as a class                                                                 |
| `core`         | `sheets-function.bench.ts`      | A function sheet resolved for a new theme view and for the same one                                                                     |
| `core`         | `tokens-references.bench.ts`    | Tokens, a theme view and the declarations of a small theme (about 20 tokens) and a large one (about 280)                                |
| `core`         | `tokens-theme-classes.bench.ts` | A theme class of each theme for a new object and for the same object, and a nested partial theme                                        |
| `react`        | `string-elements.bench.ts`      | `renderToString` of 48 elements: fixed styles, a function of the theme, a prop-driven style over 48 combinations, an override, an entry |
| `react`        | `string-trees.bench.ts`         | `renderToString` of nested providers three deep, and of a tree of 500 styled elements with and without style elements                   |
| `react`        | `server-elements.bench.ts`      | The same 48-element cases resolved with the server components build, under the `react-server` condition                                 |
| `react`        | `server-trees.bench.ts`         | The tree of 500 resolved with the server components build, with two sets of props                                                       |
| `vue`          | `render-elements.bench.ts`      | The same 48-element cases, server-rendered with Vue                                                                                     |
| `vue`          | `render-trees.bench.ts`         | The tree of 500 and nested providers, server-rendered with Vue                                                                          |
| `react-native` | `styles-elements.bench.ts`      | The same 48-element cases and the tree, resolved against a stand-in for the platform module                                             |
| `react-native` | `styles-sheets.bench.ts`        | A function sheet resolved for a new theme and for the same one, and an entry of an object sheet                                         |

The inputs the files share (the small and the large theme, the styles, the 48 prop combinations) and the helper that lets a binding's file load built code are in `bench/src/`, a workspace package that is not under `packages/`, so the package matrix of the continuous integration does not see it. The files import them by relative path.

## Running

Docker has to be running (`docker info`). From the root of the repository:

```sh
pnpm bench                   # build, then every file
pnpm bench core              # the files of one package: core, react, vue or react-native
pnpm bench classes           # the files whose name has "classes" in it
pnpm bench react string      # a package and a part of a file name together
pnpm bench --rounds 5 --md   # options go to soroush-bench as they are, for every file
```

`pnpm bench` runs `pnpm build` first, because the files load the built `dist`; then `bench/bin/local.mjs` runs each matching file with soroush-bench, one after the other (two at once would measure each other), and exits with 1 when a file failed. The first run builds the sandbox image. One run of every file, with the build, took a little over 3 minutes on a laptop.

To run one file by hand, build first and run soroush-bench from the root of the repository, which it mounts into the sandbox:

```sh
npx @soroush.tech/bench packages/core/bench/classes-merging.bench.ts --md
```

A file of a binding also loads React or Vue through `node_modules`, which pnpm links with absolute paths. Those links resolve in the sandbox only when the repository is mounted a second time at the path they point to: `--mount "<repository>:<path>:ro"`, where the path is the repository's own path, and on Windows the one Docker Desktop sees (`C:\Users\you\umber-style` is `/mnt/host/c/Users/you/umber-style`). `pnpm bench` adds that mount to every file.

The benchmarks are not tests: `pnpm test` and `pnpm test:coverage` never run them, and they do not count toward coverage. `pnpm typecheck` and `pnpm lint` do check them, and their type check needs no build (see below).

### What a file is

A file default-exports a config of two cases or more. This is `packages/core/bench/classes-merging.bench.ts` without its top comment:

```ts
import type { BenchConfig } from '@soroush.tech/bench'
import { core } from './core'

const cache = core.createCache({ prefix: 'b', sheet: core.createMemorySheet() })
const classes = Array.from({ length: 5 }, (_, index) =>
  cache.css({ color: 'red', padding: index + 1, '&:hover': { opacity: index / 10 } })
)
cache.css(classes[0], classes[1])
cache.css(...classes)

export default {
  name: 'core: merging classes',
  cases: {
    'merge two classes': () => cache.css(classes[0], classes[1]),
    'merge five classes': () => cache.css(...classes),
    'merge a class with a new object': () => cache.css(classes[0], { margin: 4 }),
  },
} satisfies BenchConfig
```

`core` is `packages/core/bench/core.ts`: the built `dist/index.cjs`, loaded with `createRequire` and typed by the source (`typeof import('../src/index')`), so that the type check passes on a tree that was never built.

soroush-bench runs a file with tsx in the sandbox, where nothing outside the file sets an environment variable or an export condition, and where the workspace link of `@umber-style/core` points at its TypeScript source. So a binding's file first calls `prepareBuiltPackages` (`bench/src/built.ts`), and loads React, Vue and the built binding after it, with `createRequire`. This is `packages/react/bench/client.ts`, which the client files import first:

```ts
prepareBuiltPackages()
const load = createRequire(import.meta.url)

export const { renderToString } = load('react-dom/server') as typeof ReactDomServer
export const binding = load('../dist/index.cjs') as typeof Binding
export const fixtures = createFixtures(
  load('react') as typeof React,
  load('../../core/dist/index.cjs') as typeof Core
)
```

`prepareBuiltPackages` sets `NODE_ENV` to `production`, and registers a resolve hook (`module.registerHooks`) that sends `@umber-style/core` to the built core, sends any other specifier it is given to a file (React Native: `react-native` to the stand-in in `packages/react-native/bench/platform.ts`), and adds export conditions (the server components files: `react-server`). A static `import` of React would be resolved before the hook exists, which is why everything after it is loaded with `createRequire`, and why the files use `createElement` and no JSX.

There is no setup outside the timed operation: what a case needs is made when the file loads. A case that needs fresh input every time walks a pool of inputs and makes a fresh cache or engine each time the pool comes round; that is part of its figure, and the file says how often.

## Reading the table

Without `--rounds`, soroush-bench prints a report for each file: for each case the average time of one operation, its minimum, maximum, p75 and p99, and the bytes allocated per operation; a box plot; and how much slower each case is than the fastest. `--md` adds a Markdown table after it (the report writes microseconds with the micro sign; here it is `us`):

```text
| case | avg | p75 | alloc/iter | vs fastest |
| --- | ---: | ---: | ---: | :--- |
| core: merging classes :: merge a class with a new object | 13.97 us | 8.73 us | 10.05 KB (+6766.3%) | fastest |
```

- **case** is `<name of the file's config> :: <case>`.
- **avg** is the mean time of one operation; **p75** the 75th percentile. If the average is far above p75, a few slow samples (garbage collection, compilation) move the mean: read p75. What one operation is, is in the comment at the top of the file: for the render cases it is one render of 48 elements or of the tree, not one element.
- **alloc/iter** is the memory allocated by one operation, estimated from the heap. It means something only well above 1 KB; below that it swings from run to run.

With `--rounds N` the whole file runs N times in the sandbox and one table of the median of each case is printed instead.

## What the figures include

- **The built packages, in production mode.** Each file measures the `dist` of this checkout, as an app loads it. React and Vue take their production paths (`NODE_ENV` is `production`).
- **Two internal functions run from the source.** `scanHtml` (in `extraction.bench.ts`) and `scanVariables` (in `pruning-scan.bench.ts`) are not exported by the built core, so those cases import them from `src/`, which tsx compiles in the sandbox. Their case names or file comments say so.
- **Node in the sandbox, with an in-memory sheet.** The engine runs with `createMemorySheet`, so a figure leaves out the cost of a browser's `insertRule`. Nothing here runs in a DOM: the real-browser figures of a page come from the end-to-end fixtures (see below).
- **Warm and cold.** A case says which it is. A "hit" or "warm" case runs over a cache that already holds what it needs (a render or a call before the measurement made it). A "miss", "new" or "cold" case makes its classes inside the operation.
- **State is not shared.** Each case makes its own engine and cache.
- **Setup that is part of a figure.** Where a case needs fresh state, the fresh cache or engine is made inside an operation once for each pass over a pool, and the file says how often. In `pruning-mark-used.bench.ts` that setup (a cache with five theme classes of the large theme) is large next to the work: it is made once for each 127 operations, and the file has a third case that measures it alone, so that 1/127 of it can be taken off the figure of a new variable.
- **The platform stand-in.** The React Native figures use `packages/react-native/bench/platform.ts`, whose `StyleSheet.create` is a plain function that returns its input. What the platform does with a style is not in them.
- **Server components.** `server-elements.bench.ts` and `server-trees.bench.ts` resolve the tree with the helper of the server tests (`src/vitest.resolveTree.ts`, compiled by tsx). It leaves out serialising to HTML, so its numbers compare with the other server numbers by shape and not by sum.

## What is not measured any more

The suite was a vitest benchmark suite until it moved to soroush-bench. These files were dropped then:

- **`core/startup.bench.ts`, `react/dom.bench.tsx` and `react/options.bench.tsx`.** They rendered into jsdom and read a style element from it, so they measured jsdom's DOM, not a browser's, and the sandbox has no DOM. The start-up read, the development checks, the DOM render and hydration, and the options measured on a DOM render are not measured now. What a browser does with a page is measured by the end-to-end fixtures and the browser tests ([Testing](testing.md)).
- **`core/memory.bench.ts`.** It reported the growth of the heap after 5,000 classes. soroush-bench reports the memory each operation allocates (`alloc/iter`) for every case.

## Noise

The sandbox pins the run to one CPU with a fixed amount of memory and no swap, which removes most of what else the machine does. It does not make a run of one file equal to the next one: the machine's clock and the other virtual machines of Docker Desktop still move it. Rules of thumb:

- Compare runs from one machine, with nothing else busy, and use `--rounds` (the median of several runs) before you read a difference of less than a fifth.
- Cases of a few nanoseconds (`helpers-arithmetic`, the later access of a sheet, the same theme object again) are at the floor of what can be timed; the report may say that such a case was "likely optimized out". Their figures are a floor, not a cost.
- To know whether a change made something slower than the last release, use the gate below, which runs both sides in one sandbox.

## The gate

The continuous integration job `bench` runs the gate with [soroush-bench](https://soroush.tech/bench/) (the package `@soroush.tech/bench`, run by the action `soroush-tech/bench-action`). It compares the build of the pull request with the last published release, in a Docker sandbox pinned to one CPU and 512 MB, and fails when a gated case is slower than the release by more than a fifth. Only UmberStyle is measured, against itself.

Each file in `bench/gate/` is one scenario with two cases:

- `local` runs the built `dist` of this checkout (`pnpm build` first), imported by relative path.
- `previous` runs the published release, which the sandbox installs from npm into its own folder and gives to the case as `modules.previous`.

`previous` is the baseline: the gate takes `baseline.avg / case.avg` as a percent, and a case below `min-ratio` (80, so anything slower than 1.25 times the release) fails its file. In the job each file is run 5 times and the median of each case is compared (`rounds: '5'`), so that one busy moment of a shared runner does not decide.

The gate files are not part of `pnpm bench`, which runs only the files in `packages/*/bench/`, and the job runs only the gate: the action runs the `*.bench.ts` files of the folder it is given (`bench-dir: bench/gate`), and the two helper files there (`baseline.ts`, `support.ts`) have no such suffix.

### What is gated

| File                        | One operation                                                                                         | Same work as                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `class-miss-small.bench.ts` | `cache.css(style)` of a small style the cache has not seen (a pool of 2000, a fresh cache each pass)  | `core/classes-creation.bench.ts`     |
| `class-miss-large.bench.ts` | the same for a large style (more than 50 declarations, pseudo selectors, media and supports queries)  | `core/classes-creation.bench.ts`     |
| `class-hit.bench.ts`        | `cache.css(style)` of the same small style again, over a cache that holds it                          | `core/classes-creation.bench.ts`     |
| `class-merge.bench.ts`      | `cache.css(a, b, c, d, e)` of five classes the cache made                                             | `core/classes-merging.bench.ts`      |
| `theme-tokens.bench.ts`     | `createTokens(theme)` and `declare(theme)` of the large theme (about 280 tokens)                      | `core/tokens-references.bench.ts`    |
| `theme-class.bench.ts`      | `engine.themeClass(theme)` of a large theme the engine has not seen (a fresh engine each pool of 100) | `core/tokens-theme-classes.bench.ts` |
| `extract-page.bench.ts`     | `extractPageStyles` for one page of ten, 300 elements, over a cache of 400 classes                    | `core/extraction.bench.ts`           |

Each side builds its own cache, engine and inputs the first time its case runs (`createSides` in `support.ts`), and the sandbox loads the release from another folder, so the two sides share no module-level state.

Not in the gate, on purpose:

- **Anything that needs a DOM**: the React DOM render and hydration, the Vue mount, the start-up reads and the development checks (they need a DOM, and the sandbox has none). The local suite does not measure them either (see "What is not measured any more").
- **The React server render.** It cannot be made like-for-like in the sandbox yet. The built `@umber-style/react` of this checkout requires `@umber-style/core`, which the workspace resolves through its `exports` to the TypeScript source (the published package points at `dist` only in `publishConfig`), so the local side would run built React over unbuilt core against a fully built release. It would also need `react` and `react-dom` for the local side from the workspace and for the release from the sandbox, two copies that must not meet. The local files get around the unbuilt core and the development mode of React with `prepareBuiltPackages` (see "What a file is"), but a gate file would still need the two copies of React kept apart. A gate that is not like-for-like would measure the setup and not the code.
- **The nanosecond operations** (`core/helpers-*`, the later access of a sheet), which settle at another speed in each process and cannot be told from a change.

### The baseline tag

The release `previous` installs is named in one place, `bench/gate/baseline.ts`: `BASELINE_TAG`, now `'latest'`: the stable release of each package on npm (0.1.0 was the first). Every gate file reads its install spec from there.

If the baseline cannot be installed (the tag does not exist, or npm cannot be reached), the sandbox run fails before it measures anything, the file counts as failed, and so the job and `ci-ok` fail. There is no way to pass without a comparison.

### Running a gate file on your machine

Docker has to be running (`docker info`), and the packages built (`pnpm build`). Run from the root of the repository, which the tool mounts into the sandbox:

```sh
npx @soroush.tech/bench bench/gate/class-hit.bench.ts --baseline-case previous --min-ratio 80 --rounds 5
```

The first run builds the sandbox image. A run prints the table of medians and, when a case is below the ratio, the lines that name it, and exits with 1. On Windows, pnpm links the workspace with absolute paths that do not exist in the sandbox; the files above need nothing from `node_modules` (they import the built `dist` of `core`, which has no dependency at run time), so no extra mount is needed. A run takes a few minutes for the larger cases, five rounds each.

### Reading a failure

```text
bench: performance target failed (min ratio 80%):
  core: the same style again :: local - 56.9% of baseline speed
```

- The percentage is `previous.avg / local.avg`: 56.9 means the local build takes 1.76 times as long as the release for that operation.
- A real regression fails every time, with a figure well under 80. Noise shows as a figure just under 80 that passes on the next run: run the job again. A file that fails with the same code on both sides is noisy, not slow; raise `rounds` for it, or leave it out of the folder.
- To look closer, run the one file as above, and add `--md` to see the p75 and the allocation of each case. Compare `avg` with `p75`: if the average is far above it, a few slow samples (garbage collection, compilation) are moving the mean.
- The job also posts the table as a comment on the pull request.

### How it was checked

With the same code on both sides (the built `core` as `local`, and a packed copy of it as `previous`, because the release was not on npm yet), all seven files passed at a ratio of 80 with five rounds, with the local side between 0.91 and 1.12 of the other. With one extra call of `cache.css` in the local side only, `class-hit` failed with 56.9% of the baseline speed and exit code 1. Two copies of the same code differing by up to 10% in one file is what the sandbox gives on a laptop under Docker Desktop; a hosted runner is not measured, and the first runs in continuous integration are the real test of the ratio.

### What the job costs

The sandbox image is built once and each file runs five rounds, so the files together take about 10 minutes on a laptop; expect 10 to 15 minutes on a hosted runner, with `timeout-minutes: 20`.

## Whole pages

These benchmarks measure parts. The numbers of a whole page (first HTML, hydration, the size of the CSS, a Lighthouse run) come from the end-to-end fixtures: see [Testing](testing.md), tier 3.

## Limits

- Nothing here runs in a real browser or on a device, and nothing runs in a DOM. Node's V8 in a Docker sandbox is not what a user's browser or phone runs, so an absolute figure is not a promise about a page.
- What a DOM render, hydration, the start-up read of a page and the development checks cost is not measured by any benchmark (see "What is not measured any more").
- The React Native binding is measured against a stand-in for the platform, so what the platform does with a style is not in it.
- `scanHtml` and `scanVariables` are measured from the source compiled by tsx, not from the build; the difference between the two was not measured.
- The figure of a new variable in `pruning-mark-used.bench.ts` includes 1/127 of a fresh cache with five theme classes, which is most of it; the cost of the marking alone is the difference of two figures, each with its own noise.
- How far two runs of this suite differ on one machine was not measured. Under the old vitest suite, two runs on a laptop differed by more than a factor of two in some cases; the sandbox is meant to narrow that, and the gate's own check found up to 10% between two copies of the same code.
- `pnpm bench` was run on Windows with Docker Desktop only. On Linux and macOS it mounts the repository at its own path for the `node_modules` links; that was not tried.
- `alloc/iter` is an estimate from the heap. Below about 1 KB it is noise, and it counts the heap of one Node process: a browser's style sheet keeps its own copy of each rule outside it.
