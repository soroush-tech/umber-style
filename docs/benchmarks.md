# Benchmarks

After this page you can run the benchmark suite on your machine, read the table it prints, run the gate that a pull request must pass, read the report that follows a release, and tell which figures are steady enough to rely on and which are not.

The suite measures UmberStyle against itself: it has no other library in it. Its purpose is to notice that a change made something slower, and to show where the time of a render goes. Every benchmark is a file for [soroush-bench](https://soroush.tech/bench/) (the package `@soroush.tech/bench`), which runs it in a Docker sandbox pinned to one CPU and 512 MB.

There are three sets of files:

- **Local files**, in `packages/<package>/bench/`: the cases of a file compare with each other, on the build of this checkout. `pnpm bench` runs them.
- **The gate**, in `bench/gate/`: each file compares this checkout with the last release, and a pull request fails when a case is more than a fifth slower. CI runs it; `pnpm bench:gate` runs it on your machine.
- **The report**, in `bench/report/`: after a release, the scenarios of the gate with every version installed from npm, written as a table to the run's summary and the GitHub Release. It is never a gate.

## What is measured

Each local file sits next to what it measures, in `packages/<package>/bench/`, and measures the built `dist` of that package. One operation of each case is described in a comment at the top of its file.

| Package        | File                            | One operation                                                                                                                                                                                                                   |
| -------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core`         | `classes-creation.bench.ts`     | `cache.css(style)` of a small or a large style the cache has not seen (a miss), or of the same or an equal style again (a hit)                                                                                                  |
| `core`         | `classes-contents.bench.ts`     | `engine.css(style)` of the same contents in a new object each call (two values in turn, the small, large and a nested style one of four), the same object again, and a style that never repeats, with `hasStyleMemo` off and on |
| `core`         | `classes-merging.bench.ts`      | `cache.css(a, b)` and `cache.css(a, b, c, d, e)` of classes the cache made, and of a class with a new style object                                                                                                              |
| `core`         | `classes-memory.bench.ts`       | A fresh cache and 1000 new small or large styles, or the 1000 small styles again over a cache that holds them: read for the memory it allocates (`alloc/iter`)                                                                  |
| `core`         | `classes-rules.bench.ts`        | `compileRules` of a small and a large style object, and `mergeStyles` of the large one                                                                                                                                          |
| `core`         | `extraction.bench.ts`           | `extract()` and `createStyleTag` of a cache with 400 classes, `extractPageStyles` for one page of ten, and the scan of its HTML                                                                                                 |
| `core`         | `helpers-arithmetic.bench.ts`   | One arithmetic helper on a token or on a literal                                                                                                                                                                                |
| `core`         | `helpers-alpha.bench.ts`        | `alpha` on a token or on a literal colour                                                                                                                                                                                       |
| `core`         | `page-startup.bench.ts`         | In jsdom: `scanStyleText` of the CSS a server sent for 400 classes, and `createCache` over a page whose head holds it (the read at start-up)                                                                                    |
| `core`         | `pruning-scan.bench.ts`         | `scanVariables` of one rule and of a large rule set                                                                                                                                                                             |
| `core`         | `pruning-mark-used.bench.ts`    | `markUsed` of a newly used variable with five theme classes, of one that is used already, and the fresh cache the first needs                                                                                                   |
| `core`         | `sheets-dom.bench.ts`           | In jsdom: a sheet from `createDomSheet` and the rules of N classes written into it, as text, an element each (`speedy: false`), or with `insertRule` (`speedy: true`)                                                           |
| `core`         | `sheets-object.bench.ts`        | An object sheet on first and later access, and an entry used as a class                                                                                                                                                         |
| `core`         | `sheets-function.bench.ts`      | A function sheet resolved for a new theme view and for the same one                                                                                                                                                             |
| `core`         | `tokens-references.bench.ts`    | `createTokens`, a theme view and `declare` of a small theme (20 tokens) and a large one (281)                                                                                                                                   |
| `core`         | `tokens-theme-classes.bench.ts` | `themeClass` of each theme for a new object and for the same object, and of a nested partial theme                                                                                                                              |
| `css`          | `class-name.bench.ts`           | `css(style)` of this package next to `engine.css(style)` of the core, for a hit and a miss                                                                                                                                      |
| `css`          | `class-contents.bench.ts`       | `css(style)` of this package with the same contents in a new object each call, and a style that never repeats, with `hasStyleMemo` off and on                                                                                   |
| `css`          | `versus-styled.bench.ts`        | One element of the small style rendered to a string: a `div` with the class of `css`, and a styled component of `@umber-style/react` with and without its style element                                                         |
| `react`        | `dom-hydration.bench.ts`        | In jsdom: the server markup of the tree of 500 hydrated with `hydrateRoot`, with a fresh engine and with a warm one, and the markup set and removed alone                                                                       |
| `react`        | `dom-trees.bench.ts`            | In jsdom: the tree of 500 rendered into a root: a first render, a render with the same props, with changed props, and a provider with the same theme and with another                                                           |
| `react`        | `string-elements.bench.ts`      | `renderToString` of 48 elements: fixed styles, a function of the theme, a prop-driven style over 48 combinations, an override through `style`, a sheet entry                                                                    |
| `react`        | `string-options.bench.ts`       | `renderToString` of 48 prop-driven elements, cold and warm, with each of `hasLayers`, `hasBaseClass`, `hasPruning`, `hasLabels`, `hasColorFallbacks`, `hasScope` on and off                                                     |
| `react`        | `string-props.bench.ts`         | `renderToString` of 48 elements choosing between 2 styles by a prop, of 48 prop-driven elements of 48 combinations, and of the tree of 500 with prop-driven rows, with `hasStyleMemo` off and on                                |
| `react`        | `string-trees.bench.ts`         | `renderToString` of nested providers three deep, and of the tree of 500 styled elements with and without style elements                                                                                                         |
| `react`        | `server-elements.bench.ts`      | The same 48-element cases resolved with the server components build, under the `react-server` condition                                                                                                                         |
| `react`        | `server-trees.bench.ts`         | The tree of 500 resolved with the server components build, with two sets of props                                                                                                                                               |
| `react`        | `values-setter.bench.ts`        | In jsdom: a slider thumb given 50 new numbers and one macrotask, through the setter of `useStyleValue` and through a render with a plain object in `style`                                                                      |
| `vue`          | `dom-hydration.bench.ts`        | In jsdom: the server markup of the tree of 500 hydrated by a server app, with a fresh engine and with a warm one, and the markup set and removed alone                                                                          |
| `vue`          | `dom-trees.bench.ts`            | In jsdom: the tree of 500 in a mounted app: a first render, a render with the same props, with changed props, and a theme change through the provider                                                                           |
| `vue`          | `render-elements.bench.ts`      | The same 48-element cases, server-rendered with Vue                                                                                                                                                                             |
| `vue`          | `render-trees.bench.ts`         | The tree of 500 and nested providers, server-rendered with Vue                                                                                                                                                                  |
| `react-native` | `styles-elements.bench.ts`      | The same 48-element cases and the tree, resolved against a stand-in for the platform module                                                                                                                                     |
| `react-native` | `styles-sheets.bench.ts`        | A function sheet resolved for a new theme and for the same one, and an entry of an object sheet                                                                                                                                 |

The inputs the files share (the small and the large theme, the styles, the 48 prop combinations) and the helper that lets a binding's file load built code are in `bench/src/`, a workspace package that is not under `packages/`, so the package matrix of the continuous integration does not see it. The files import them by relative path.

## Running

Docker has to be running (`docker info`). From the root of the repository:

```sh
pnpm bench                   # build, then every local file
pnpm bench core              # the files of one package: core, css, react, vue or react-native
pnpm bench classes           # the files whose name has "classes" in it
pnpm bench react string      # a package and a part of a file name together
pnpm bench --rounds 5 --md   # options go to soroush-bench as they are, for every file
pnpm bench:gate              # build, then the gate against the last release (see "The gate")
```

`pnpm bench` runs `pnpm build` first, because the files load the built `dist`; then `bench/bin/local.mjs` runs each matching file with soroush-bench, one after the other (two at once would measure each other), and exits with 1 when a file failed. The first run builds the sandbox image.

To run one file by hand, build first and run soroush-bench from the root of the repository, which it mounts into the sandbox:

```sh
npx @soroush.tech/bench packages/core/bench/classes-merging.bench.ts --md
```

A file of a binding, and a file that needs jsdom, also loads modules through `node_modules`, which pnpm links with absolute paths on Windows. Those links resolve in the sandbox only when the repository is mounted a second time at the path they point to: `--mount "<repository>:<path>:ro"`, where the path is the repository's own path, and on Windows the one Docker Desktop sees (`C:\Users\you\umber-style` is `/mnt/host/c/Users/you/umber-style`). `pnpm bench` adds that mount to every file.

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

A file that renders into a DOM makes a document of jsdom first and puts it on `globalThis` before React or Vue loads, because both read `document` as they start: `packages/react/bench/dom.ts`, `packages/vue/bench/dom.ts` and `packages/core/bench/dom.ts`.

There is no setup outside the timed operation: what a case needs is made when the file loads. A case that needs fresh input every time walks a pool of inputs and makes a fresh cache or engine each time the pool comes round; that is part of its figure, and the file says how often. Where the setup is a large part of an operation (a first render into a fresh root, hydration of fresh markup, a fresh page), the file has a case that measures the setup alone, so that it can be taken off.

## Reading the table

Without `--rounds`, soroush-bench prints a report for each file: for each case the average time of one operation, its minimum, maximum, p75 and p99, and the bytes allocated per operation; a box plot; and how much slower each case is than the fastest. `--md` adds a Markdown table after it (the report writes microseconds with the micro sign; here it is `us`):

```text
| case | avg | p75 | alloc/iter | vs fastest |
| --- | ---: | ---: | ---: | :--- |
| core: merging classes :: merge a class with a new object | 13.97 us | 8.73 us | 10.05 KB (+6766.3%) | fastest |
```

- **case** is `<name of the file's config> :: <case>`.
- **avg** is the mean time of one operation; **p75** the 75th percentile. If the average is far above p75, a few slow samples (garbage collection, compilation) move the mean: read p75. What one operation is, is in the comment at the top of the file: for the render cases it is one render of 48 elements or of the tree, not one element.
- **alloc/iter** is the memory allocated by one operation, estimated from the heap. It means something only well above 1 KB; below that it swings from run to run. `classes-memory.bench.ts` is the file to read it in: what a cache allocates for 1000 distinct styles.

With `--rounds N` the whole file runs N times in the sandbox and one table of the median of each case is printed instead.

## What the figures include

- **The built packages, in production mode.** Each file measures the `dist` of this checkout, as an app loads it. React and Vue take their production paths (`NODE_ENV` is `production`).
- **Two internal functions run from the source.** `scanHtml` (in `extraction.bench.ts`), `scanVariables` (in `pruning-scan.bench.ts`) and `scanStyleText` (in `page-startup.bench.ts`) are not exported by the built core, so those cases import them from `src/`, which tsx compiles in the sandbox. Their case names or file comments say so.
- **Node in the sandbox, with an in-memory sheet.** The engine runs with `createMemorySheet`, so a figure leaves out the cost of a browser's `insertRule`, except in `sheets-dom.bench.ts`, which writes into jsdom's style element on purpose.
- **jsdom where a file needs a DOM.** `page-startup`, `sheets-dom`, `values-setter` and the `dom-*` files run in a document of jsdom. Its DOM, its CSS parser and its style sheets are not a browser's: the figures hold the engine's work, the framework's and jsdom's, and compare cases with each other, not with a page. The engine still writes into memory in the `dom-*` files. In `page-startup` the page's `MutationObserver` is a stand-in that watches nothing: jsdom's own keeps every cache it was given reachable after its page is gone (about 22 KB a cache), which ran the sandbox out of memory over five rounds.
- **Warm and cold.** A case says which it is. A "hit" or "warm" case runs over a cache that already holds what it needs (a render or a call before the measurement made it). A "miss", "new", "cold", "fresh" or "first" case makes its classes inside the operation.
- **State is not shared.** Each case makes its own engine and cache.
- **Setup that is part of a figure.** In `pruning-mark-used.bench.ts` a cache with five theme classes of the large theme is made once for each 127 operations, and the file has a case that measures that setup alone. In the `dom-*` files a first render includes its fresh engine, root and unmount, and a hydration its fresh markup, and the setup has a case of its own.
- **The platform stand-in.** The React Native figures use `packages/react-native/bench/platform.ts`, whose `StyleSheet.create` is a plain function that returns its input. What the platform does with a style is not in them.
- **Server components.** `server-elements.bench.ts` and `server-trees.bench.ts` resolve the tree with the helper of the server tests (`src/vitest.resolveTree.ts`, compiled by tsx). It leaves out serialising to HTML, so its numbers compare with the other server numbers by shape and not by sum.

### Writing rules as text

`sheets-dom.bench.ts` is there to show what a change to the text sheet does. It runs 200 and 800 classes as text and 200, 800 and 3200 with `insertRule`. Before 0.3.0 each rule was a text node of one style element, and jsdom parsed the whole text of the element again for every node, so the cost grew with the square of the number of classes. Now each rule is the text of an element of its own, which is parsed once, and both ways grow with the number. In the sandbox, one operation:

| Classes | Text, one element (0.2.0) | Text, an element for each rule | `insertRule` |
| ------: | ------------------------: | -----------------------------: | -----------: |
|     200 |              3.0 to 4.0 s |                         104 ms |        35 ms |
|     800 |                      49 s |                         306 ms |       146 ms |
|    3200 |                   not run |                        not run |       456 ms |

The first column is the figure recorded before the change (3200 was not run: one operation would have taken about thirteen minutes). By text, 800 classes take 2.9 times as long as 200, for four times the classes. 3200 by text is not run because it runs the sandbox out of memory: jsdom keeps every style element that was ever in its document after it is removed (a few kilobytes each, measured with jsdom alone, without the engine), and one operation of 3200 classes makes 6401 of them, each sample adding to the last.

### Not measured

- The development checks (`findMissingStyles` and the checks of values): every file runs with `hasDevChecks: false` or in production.
- The options of the cache on a render into a DOM: `string-options.bench.ts` measures them on a server render.
- Vue's provider rendered again with the same theme: Vue does not render a provider again when nothing it reads changed, so the case has nothing to measure; `dom-trees.bench.ts` of Vue has the theme change.

## Noise

The sandbox pins the run to one CPU with a fixed amount of memory and no swap, which removes most of what else the machine does. It does not make a run of one file equal to the next one: the machine's clock and the other virtual machines of Docker Desktop still move it. Rules of thumb:

- Compare runs from one machine, with nothing else busy, and use `--rounds` (the median of several runs) before you read a difference of less than a fifth. The two settings of an option in `string-options.bench.ts` differ by less than that in most rows, so read that file with `--rounds 5`.
- Cases of a few nanoseconds (`helpers-arithmetic`, the later access of a sheet, the same theme object again, a provider rendered again with the same theme) are at the floor of what can be timed; the report may say that such a case was "likely optimized out". Their figures are a floor, not a cost.
- To know whether a change made something slower than the last release, use the gate below, which runs both sides in one sandbox.

## The gate

The continuous integration job `bench` runs the gate with soroush-bench (run by the action `soroush-tech/bench-action`). It compares the build of the pull request with the build of the last release of the core, in a Docker sandbox pinned to one CPU and 512 MB, and fails when a gated case is slower than the release by more than a fifth.

### What is compared

Each file in `bench/gate/` is one scenario with two cases:

- `current` runs `packages/core/dist/index.cjs`, the build of this checkout (`pnpm build` first).
- `previous` runs `.bench-previous/packages/core/dist/index.cjs`: the core of the last release, checked out from its git tag and built in the same job.

Both are files in the repository that the sandbox mounts, and `bench/gate/support.ts` loads both with `require` by path, the same way, when the file loads. A file whose two builds are not both there fails before it measures anything, so the job fails: the gate never passes without a comparison.

`previous` is the baseline: soroush-bench takes `previous.avg / current.avg` as a percent, and a case below `min-ratio` (80, so anything slower than 1.25 times the release) fails its file. Each file is run 5 times and the median of each case is compared (`rounds: '5'`), so that one busy moment of a shared runner does not decide.

The scenarios themselves are written once, in `bench/gate/scenarios.ts`, and a gate file is one line over one of them; the report after a release runs the same scenarios (see below).

### Why local against local

The gate used to install the release from npm inside the sandbox and load the current build from the mounted repository. The two sides were loaded differently, and on identical code the local side came out 0.8% to 5.7% slower, always in the same direction. Now both sides are made and loaded the same way. On identical code (this checkout against a second build of its own last commit) the medians of the seven files were within -0.2% and +8.3% of each other, and the faster side changed from file to file: what is left is the noise of the machine, not a difference between the sides. A run against the release itself is in "How it was checked".

### How the release is chosen

`bench/bin/previous.mjs` makes the `previous` side:

1. It lists the tags `@umber-style/core@<version>` of the repository, read from its public address, and takes the newest that `BASELINE_RELEASE` in `bench/gate/baseline.ts` allows. That constant is `'stable'`: the last stable release. `'newest'` takes the newest tag, stable or release candidate (alphas have no tag). It is one word, and it decides for CI and for `pnpm bench:gate` alike.
2. It fetches that one commit into the clone when it is not there (into `FETCH_HEAD` only, with `--depth=1` in a shallow clone), and writes its tree into `.bench-previous/` with `git archive`. No tag, branch or worktree of the clone changes.
3. It installs the core and what it needs with that release's own lockfile (`pnpm install --frozen-lockfile --ignore-scripts --filter @umber-style/core...`) and builds the core with that release's own tooling, so the build is the one the release made. Building the old source with the current tooling instead would put a change of tooling into the comparison.

`.bench-previous/` is inside the repository because the sandbox mounts only the repository. Git ignores it, and so does every other tool: the formatter reads `.gitignore`, and lint, the type checks, the tests and coverage run inside each package's folder, which it is not. When the folder already holds a build of the same commit, the script leaves it as it is.

### Running the gate on your machine

Docker has to be running (`docker info`). From the root of the repository:

```sh
pnpm bench:gate                 # build, the last release, then every gate file
pnpm bench:gate class           # the gate files whose name has "class" in it
pnpm bench:gate --ref HEAD      # against a second build of the last commit, to see the noise
pnpm bench:gate --rounds 1      # a quick look; options go to soroush-bench after the job's own
```

`bench/bin/gate.mjs` runs `previous.mjs` (with `--ref` when it is given: a tag, a branch, a commit id), then each gate file with soroush-bench and the job's options (`--baseline-case previous --min-ratio 80 --rounds 5`), one after the other, and exits with 1 when a file failed. The first run builds the sandbox image and the previous build; seven files at five rounds take about ten minutes on a laptop.

### Reading a failure

```text
bench: performance target failed (min ratio 80%):
  core: the same style again :: current - 48.3% of baseline speed
```

- The percentage is `previous.avg / current.avg`: 48.3 means this checkout takes about twice as long as the release for that operation.
- A real regression fails every time, with a figure well under 80. Noise shows as a figure just under 80 that passes on the next run: run the job again. A file that fails on identical code (`pnpm bench:gate --ref HEAD`) is noisy, not slow; raise `rounds` for it, or leave it out of the folder.
- To look closer, run the one file with `--md` to see the p75 and the allocation of each case. Compare `avg` with `p75`: if the average is far above it, a few slow samples are moving the mean.
- The job also posts the table as a comment on the pull request.

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

Each side builds its own cache, engine and inputs the first time its case runs (`createSide` in `bench/gate/support.ts`), so the two sides share no state.

Not in the gate, on purpose:

- **Anything that needs a DOM or a framework**: the jsdom files and the renders. jsdom's own cost is most of their figure, and a binding would need React or Vue loaded for two builds side by side.
- **The nanosecond operations** (`core/helpers-*`, the later access of a sheet), which settle at another speed in each process and cannot be told from a change.
- **`classes-memory`, `page-startup` and `sheets-dom`.** Over five rounds on a laptop, `classes-memory` moved from 5.8 to 21 milliseconds for the same 1000 small styles, too far to gate. `createCache` reading a page in `page-startup` was steady (991 to 1047 microseconds), but it needs jsdom, which a gate file would load from a package's `node_modules` in the sandbox of the action, and that was not tried. `sheets-dom` measures jsdom's style elements more than the engine.

### How it was checked

On a laptop under Docker Desktop, five rounds each:

- This checkout against a second build of its own last commit (`--ref HEAD`): all seven files passed, with `current` between 0.2% faster and 8.3% slower than `previous`, and faster in two of the seven files.
- This checkout against `@umber-style/core@0.2.0`: all seven files passed. `extract-page` was 12.8% faster than 0.2.0, `class-miss-small` within 1%, `class-hit` and `class-merge` 3% to 5% slower, `class-miss-large` 7%, `theme-class` 12% and `theme-tokens` 14% slower, still above the ratio of 80.
- With a loop added to the path every class takes in the core, in the working tree only (60 extra calls of the hash each time a class is named, then removed), four files failed and the exit code was 1: `class-hit` at 8.2% of the release's speed, `class-miss-small` at 15.6%, `class-miss-large` at 15.7% and `class-merge` at 32.8%. The three files that do not name a class (`extract-page`, `theme-class`, `theme-tokens`) passed.

### What the job costs

The previous build adds about a minute (a filtered install from the pnpm store and one build). The files take about ten minutes on a laptop; expect 10 to 15 minutes on a hosted runner, with `timeout-minutes: 25`.

## The report after a release

After the workflow `CD - Packages (npm)` publishes, its job `bench-report` runs `scripts/bench-report.mjs` with the `<name>@<version>` of each package it published. For a package that has report scenarios (only `@umber-style/core`), the script waits until the registry lists the version (30 tries, 10 seconds apart), picks the versions to compare, and runs the scenarios of `bench/report/` with every version installed from npm in the sandbox, five rounds each. It is a report, not a gate: the job may fail without failing the release, and the summary says so when it could not run.

Which versions are compared (`planReport` in `bench/src/releases.ts`):

| Release just made                                                                 | Compared with                                                                                   | Versions in the table |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------- |
| a release candidate, `0.3.0-rc.1`                                                 | the previous release candidate of the same version (`0.3.0-rc.0`) and the last stable (`0.2.0`) | 3                     |
| an alpha, `0.3.0-alpha.1`                                                         | the previous alpha of the same version (`0.3.0-alpha.0`) and the last stable (`0.2.0`)          | 3                     |
| the first prerelease of its channel for a version (`0.3.0-rc.0`, `0.3.0-alpha.0`) | the last stable only                                                                            | 2                     |
| a stable release, `0.3.0`                                                         | the previous stable only (`0.2.0`)                                                              | 2                     |

"Previous" is the highest that exists below the version just published on its channel, for the same version: `0.3.0-rc.2` for `0.3.0-rc.3`, or `0.3.0-rc.1` when `rc.2` was never published. An rc is never compared with an alpha. "The last stable" is the highest stable version below the one released, never the placeholder `0.0.0` or `0.0.0-stage`. A package with no stable yet is compared with the previous release of its channel alone; the first release of a package has nothing to compare, and the job says so and passes. The other packages get a line that says they have no report scenarios.

### Reading the report

```text
| Scenario | 0.1.0 (last stable) | 0.2.0-alpha.0 (previous alpha) | 0.2.0-alpha.1 (published) |
| --- | ---: | ---: | ---: |
| core: the same style again | 2.03 us | 2.35 us (86.6%) | 2.22 us (91.4%) |
| core: a theme and its variables | 1.43 ms | 1.39 ms (102.9%) | 1.35 ms (106.2%) |
```

That is two rows of the report of `0.2.0-alpha.1`, made on a laptop as if it had just been published.

- Each row is one file of `bench/report/` (one scenario of the gate). Each cell is the median of five rounds of the mean time of one operation.
- The percentage in brackets is the speed against the baseline, the last stable (or, with no stable, the previous release of the channel): `baseline.avg / version.avg`, so above 100% is faster than the baseline. The figure is soroush-bench's own: the script asks its gate for a target no case reaches, so that it prints the ratio of every case, and reads it from there.
- The table is in the summary of the run. For an rc or a stable release it is also added below the notes of its GitHub Release, after a marker that a run again replaces from; the notes file `release-notes/<version>.md` is not changed. An alpha has no GitHub Release, so its table is in the summary only.

To make the report of a past release on your machine, as if it had just been published (Docker running, the workspace installed):

```sh
node scripts/bench-report.mjs @umber-style/core@0.2.0-alpha.1
```

## Whole pages

These benchmarks measure parts. The numbers of a whole page (first HTML, hydration in a browser, the size of the CSS, a Lighthouse run) come from the end-to-end fixtures: see [Testing](testing.md), tier 3.

## Limits

- Nothing here runs in a real browser or on a device. Node's V8 in a Docker sandbox is not what a user's browser or phone runs, and jsdom is not a browser's DOM, so an absolute figure is not a promise about a page.
- The development checks are not measured by any benchmark (see "Not measured").
- The React Native binding is measured against a stand-in for the platform, so what the platform does with a style is not in it.
- `scanHtml`, `scanVariables` and `scanStyleText` are measured from the source compiled by tsx, not from the build; the difference between the two was not measured.
- The figure of a new variable in `pruning-mark-used.bench.ts` includes 1/127 of a fresh cache with five theme classes, which is most of it; the cost of the marking alone is the difference of two figures, each with its own noise. The same holds for the setup cases of the `dom-*` files.
- `sheets-dom.bench.ts` has no case of 3200 classes written as text: jsdom keeps every style element it removed, and 6401 elements an operation run the sandbox out of memory. How text mode grows in a browser is checked by `sheetText.browser.test.ts` of the core (1600 rules in Chromium), outside the benchmarks.
- The gate on identical code differed by up to 8.3% on a laptop; a hosted runner was not measured, and the first runs in continuous integration are the real test of the ratio. The action of the job vendors soroush-bench 2.1.0, the workspace (and so `pnpm bench:gate`) has 2.2.3; their gate rule is the same.
- The gate builds the release from its git tag: a release whose lockfile can no longer be installed stops the gate.
- The `bench-report` job has not run in GitHub Actions; its script and its files were run on a laptop for past releases. The report compares versions measured in one job on one runner.
- `pnpm bench` was run on Windows with Docker Desktop only. On Linux and macOS it mounts the repository at its own path for the `node_modules` links; that was not tried.
- `alloc/iter` is an estimate from the heap. Below about 1 KB it is noise, and it counts the heap of one Node process: a browser's style sheet keeps its own copy of each rule outside it.
