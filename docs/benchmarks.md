# Benchmarks

After this page you can run the benchmark suite on your machine, read the table it prints, compare two runs, and tell which figures are steady enough to rely on and which are not.

The suite measures UmberStyle against itself: it has no other library in it. Its purpose is to notice that a change made something slower, and to show where the time of a render goes.

## What is measured

Each benchmark file sits next to what it measures, in `packages/<package>/bench/`. One operation of each case is described in a comment at the top of its file.

| Package        | File                    | What it measures                                                                                                                                                                                                                     |
| -------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `core`         | `classes.bench.ts`      | Class creation: a style the cache has not seen (a miss), the same style again (a hit), merging two and five classes, and a style object compiled to rules                                                                            |
| `core`         | `tokens.bench.ts`       | Tokens and references for a small theme (about 20 tokens) and a large one (about 280), a theme view, a theme class for each, and a nested partial theme                                                                              |
| `core`         | `helpers.bench.ts`      | Each arithmetic helper on a token and on a literal, and `alpha` on a token and on a literal                                                                                                                                          |
| `core`         | `pruning.bench.ts`      | Scanning rules for the variables they use, and a newly used variable added to five theme classes                                                                                                                                     |
| `core`         | `extraction.bench.ts`   | `extract()` of a cache with 400 classes, `extractPageStyles` for one page out of ten, and the scan of that page's HTML                                                                                                               |
| `core`         | `startup.bench.ts`      | Reading what a page already has from a style element of 400 classes, and one pass of the development checks (jsdom)                                                                                                                  |
| `core`         | `sheets.bench.ts`       | An object sheet on first and later access, and a function sheet resolved for a theme view                                                                                                                                            |
| `core`         | `memory.bench.ts`       | Heap growth after 5,000 distinct props classes and after 5,000 repeats of one. Reported, never compared                                                                                                                              |
| `react`        | `string.bench.tsx`      | `renderToString` of 48 elements (fixed styles, a function of the theme, a prop-driven style over 48 combinations, an override through `style`, a single sheet entry), nested providers three deep, and a tree of 500 styled elements |
| `react`        | `dom.bench.tsx`         | The tree of 500 rendered into jsdom: first render, re-render with the same props, with changed props, a provider re-rendered with the same theme and with another theme, and hydration of server markup                              |
| `react`        | `tree.server.bench.tsx` | The same elements and tree resolved with the server components build, under the `react-server` condition                                                                                                                             |
| `react`        | `options.bench.tsx`     | Each of `hasLayers`, `hasBaseClass`, `hasPruning`, `hasLabels`, `hasColorFallbacks`, `hasScope` and `hasDevChecks` on and off, for three cases                                                                                       |
| `vue`          | `render.bench.ts`       | The same 48-element cases, nested providers, and the tree of 500, server-rendered                                                                                                                                                    |
| `react-native` | `styles.bench.tsx`      | The same cases and the tree resolved against the stand-in platform module the tests use, and a sheet per theme                                                                                                                       |

The helpers the files share (the small and the large theme, the styles, the 48 prop combinations, and the code that runs a group and writes its result) are in `bench/`, a workspace package that is not under `packages/`, so the package matrix of the continuous integration does not see it.

## Running

```sh
pnpm bench                  # everything: about a minute and a half
pnpm bench core             # one package: core, react, vue or react-native
pnpm bench tokens           # the files whose path has "tokens" in it, in every package
pnpm bench react options    # a package and a file filter together
```

A run does one package after the other, and one file after the other inside a package, because two files at once would measure each other. For each file it prints the table of its groups; at the end it prints one table of every case and the memory figures.

| Variable        | Default               | What it does                                                                                                      |
| --------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `BENCH_TIME`    | `200`                 | Milliseconds each case is measured for. A larger value is a longer and steadier run: `BENCH_TIME=2000 pnpm bench` |
| `BENCH_WARMUP`  | a quarter of the time | Milliseconds each case runs before it is measured                                                                 |
| `BENCH_OUT_DIR` | `bench/results`       | Where the results are written                                                                                     |

Some groups multiply the time by a factor (the options and the DOM groups run four and three times as long), because their cases are slow or their figures are close.

The benchmarks are not tests: `pnpm test` and `pnpm test:coverage` never run them, and they do not count toward coverage. `pnpm typecheck` and `pnpm lint` do check them.

### What the form is

In vitest 5 a benchmark is not an export of `vitest`: importing `bench` from it fails. A benchmark is a test (`it`) in a `*.bench.ts(x)` file, run by `vitest bench`, and it takes `bench` from its test context:

```ts
it('two cases', async ({ bench }) => {
  const first = bench('first', () => 1 + 1)
  const second = bench('second', () => Math.sqrt(2))
  await bench.compare(first, second, { time: 200 })
})
```

The files do not call this directly: `runGroup` in `bench/src/harness.ts` registers the cases of a group, runs them, and records what was measured. A package has a `vitest.bench.config.ts` of its own (the default config is for tests).

## Reading the table

```text
case                                                           ops/s    margin
core/classes > class creation > hit: the same small style ...  378 414   +-1.16%
```

- **case** is `<package>/<file> > <group> > <name>`. It is what two runs are matched by, so renaming a case makes it appear as removed and added.
- **ops/s** is operations per second, `1000 / mean`, where the mean is the mean time of one operation in milliseconds. A bigger number is faster. What one operation is, is in the comment at the top of the file: for the render cases it is one render of 48 elements or of the tree, not one element.
- **margin** is the relative margin of error of the mean at 95% confidence. It says how well this run knows its own mean. It does not say how much two runs differ: that is the noise section below.

Each run writes, in `bench/results/` (ignored by git): `<package>.json` for each package, `all.json` for all of them, and `report.md`, a Markdown table with the mean and the number of samples too. A case in the JSON has its `id`, `hz` (operations per second), `mean` (milliseconds), `rme` (the relative margin of error, in percent) and `samples`. The memory figures are in a `memory` list next to the cases.

## Comparing two runs

```sh
pnpm bench:compare before.json after.json          # thresholds 0.8 and 1.25
pnpm bench:compare before.json after.json 0.9 1.1  # lower, then upper
```

For each case it prints the ratio of the second run to the first in operations per second: below 1 the case got slower. A case below the lower threshold is marked `SLOWER` and a case above the upper one `faster`; a case that only one file has is `added` or `removed`. The exit code is 1 when any case is `SLOWER`, 2 for a wrong call, and 0 otherwise. The continuous integration gate does not use this command (it is soroush-bench, below), but this is the way to look at two single runs of the vitest suite. The logic is in `bench/src/compare.ts`, with its unit tests.

The two files should come from the same machine, in the same state, with the same `BENCH_TIME`.

## What the figures include

- **Run on Node, mostly with an in-memory sheet.** The engine runs with `createMemorySheet`, so a figure leaves out the cost of a browser's `insertRule`. Where a file needs a DOM (`startup`, `dom`, `options`) it runs in jsdom, whose elements, style sheet and `getComputedStyle` are not a browser's. The real-browser figures of a page come from the end-to-end fixtures (see below).
- **Production mode.** The React, Vue and React Native packages run with `NODE_ENV=production`, so React and Vue take their production paths.
- **Module overhead.** vitest runs the source through its module runner, which reads each export of another module through a getter. That adds a little to every call between two files of the engine. The numbers are comparable from run to run, but they are not the speed of a built bundle.
- **Warm and cold.** A case says which it is. A "hit" or "warm" case runs over a cache that already holds what it needs. A "miss", "cold" or "first render" case makes a fresh engine for each operation, before the timer starts where the setup is not what is measured; the classes are then made inside the operation.
- **State is not shared.** Each case makes its own engine and cache. Where a case needs fresh input every time (a style the cache has not seen), it walks a pool of inputs and makes a fresh cache each time the pool comes round; that cache is part of the figure, and the file says how often.
- **jsdom's DOM work is in the DOM figures.** The render cases of `dom.bench.tsx` include React's render and commit and jsdom's DOM operations. The re-render with the same props is the best measure of the engine's own share, because nothing changes in the DOM.
- **The platform stand-in.** The React Native figures use the stand-in module of the tests, whose `StyleSheet.create` is a mock that records its calls; the benchmark clears the record after each operation.
- **Server components.** `tree.server.bench.tsx` resolves the tree with the helper of the tests. It leaves out serialising to HTML, so its numbers compare with the other server numbers by shape and not by sum.
- **Memory.** The memory figures are the growth of the V8 heap across a piece of work, with a collection forced before and after (the benchmark config passes `--expose-gc`). They are reported and never compared or asserted.

## Noise

A figure is the mean of many samples, so its own margin is small, but two runs can still differ by more than that: the margin does not include what else the machine does. The noise of this suite on a laptop is in the section "Noise of two runs" below. Rules of thumb:

- Compare runs from one machine, with nothing else busy. A browser, a build or a virus scan during a run moves the figures of the cases that ran at that time.
- Cases of a few nanoseconds to a microsecond move the most in relative terms; so do the cases that make a fresh engine for each operation.
- A threshold of 0.8 is meant to catch a change of a quarter in a case that is steady. Do not gate on a case that is listed as noisy: the gate below gates only operations that proved steady in the sandbox.

What was found to make cases unstable, and what is done about it:

- **The machine drifts between runs.** Whole groups of cases move together, in one direction, for the length of a run (a second run was faster than the first in most of the 139 cases). Nothing in the harness can remove that. The gate runs both sides in the same sandbox, in rounds, and takes the median.
- **A case settles at its own speed in each process.** The operations of a few nanoseconds (`core/helpers`, `core/sheets`) ran at different speeds in different processes with the same code, which no run time evens out. They are measured and not gated. Files run one after the other, never two at once.
- **Garbage of the case before.** Each case now starts with a forced collection (`beforeAll` in `runGroup`), so that it does not pay for what the one before left. This lowered the number of cases more than 10% apart between two runs of the same files a little (26 and 29 of 70 before, 17, 19 and 26 of 70 after); the machine's drift is larger than this effect, and it was kept because it costs nothing.
- **Time and warm-up were left alone.** A longer `BENCH_TIME` was not tried: it makes each figure better known, but not less dependent on the process or the minute it was measured in, and it multiplies the time of every round.

## Noise of two runs

Two runs of the whole suite, one after the other on one Windows laptop (Node 26, vitest 5.1.1, `BENCH_TIME` 200) with other programs open, gave these ratios of the second run to the first, over the 139 cases:

| Package        | Cases | Median ratio | Lowest | Highest | Cases within 0.9 to 1.1 |
| -------------- | ----- | ------------ | ------ | ------- | ----------------------- |
| `core`         | 58    | 0.92         | 0.41   | 1.64    | 25                      |
| `react`        | 65    | 0.94         | 0.44   | 1.64    | 26                      |
| `vue`          | 7     | 0.91         | 0.72   | 1.51    | 1                       |
| `react-native` | 9     | 0.76         | 0.65   | 1.54    | 1                       |

80 of the 139 cases were within the default thresholds of 0.8 and 1.25, and `pnpm bench:compare` between the two runs exited 1 with 42 cases below 0.8. The margin of error each run printed (mostly 1% to 10%) was far smaller than that: it does not cover what the machine did between the runs. The cases that moved most (below 0.5 or above 1.5) were the start-up reads, the theme classes made for a new object, and the first and small cases of the React server render, the DOM render of the same props, and the React Native object sheet. Do not gate on one run of a case from a laptop in this state: compare against a run made just before on the same machine, and better, take the median of rounds as the gate below does.

## The gate

The continuous integration job `bench` runs the gate with [soroush-bench](https://soroush.tech/bench/) (the package `@soroush.tech/bench`, run by the action `soroush-tech/bench-action`). It compares the build of the pull request with the last published release, in a Docker sandbox pinned to one CPU and 512 MB, and fails when a gated case is slower than the release by more than a fifth. Only UmberStyle is measured, against itself.

Each file in `bench/gate/` is one scenario with two cases:

- `local` runs the built `dist` of this checkout (`pnpm build` first), imported by relative path.
- `previous` runs the published release, which the sandbox installs from npm into its own folder and gives to the case as `modules.previous`.

`previous` is the baseline: the gate takes `baseline.avg / case.avg` as a percent, and a case below `min-ratio` (80, so anything slower than 1.25 times the release) fails its file. In the job each file is run 5 times and the median of each case is compared (`rounds: '5'`), so that one busy moment of a shared runner does not decide.

The gate files are not part of `pnpm bench`: the vitest suite looks only inside `packages/*/bench/`, and the gate files are in `bench/gate/`, a folder neither the vitest configs nor the unit tests include. The action, for its part, runs only the `*.bench.ts` files of the folder it is given (`bench-dir: bench/gate`), and the two helper files there (`baseline.ts`, `support.ts`) have no such suffix.

### What is gated

| File                        | One operation                                                                                         | Same work as               |
| --------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------- |
| `class-miss-small.bench.ts` | `cache.css(style)` of a small style the cache has not seen (a pool of 2000, a fresh cache each pass)  | `core/classes.bench.ts`    |
| `class-miss-large.bench.ts` | the same for a large style (more than 50 declarations, pseudo selectors, media and supports queries)  | `core/classes.bench.ts`    |
| `class-hit.bench.ts`        | `cache.css(style)` of the same small style again, over a cache that holds it                          | `core/classes.bench.ts`    |
| `class-merge.bench.ts`      | `cache.css(a, b, c, d, e)` of five classes the cache made                                             | `core/classes.bench.ts`    |
| `theme-tokens.bench.ts`     | `createTokens(theme)` and `declare(theme)` of the large theme (about 280 tokens)                      | `core/tokens.bench.ts`     |
| `theme-class.bench.ts`      | `engine.themeClass(theme)` of a large theme the engine has not seen (a fresh engine each pool of 100) | `core/tokens.bench.ts`     |
| `extract-page.bench.ts`     | `extractPageStyles` for one page of ten, 300 elements, over a cache of 400 classes                    | `core/extraction.bench.ts` |

Each side builds its own cache, engine and inputs the first time its case runs (`createSides` in `support.ts`), and the sandbox loads the release from another folder, so the two sides share no module-level state.

Not in the gate, on purpose:

- **Anything that needs a DOM**: the React DOM render and hydration, the Vue mount, the start-up reads and the development checks (they need jsdom, and the sandbox has none). `pnpm bench` still measures them.
- **The React server render.** It cannot be made like-for-like in the sandbox yet. The built `@umber-style/react` of this checkout requires `@umber-style/core`, which the workspace resolves through its `exports` to the TypeScript source (the published package points at `dist` only in `publishConfig`), so the local side would run built React over unbuilt core against a fully built release. It would also need `react` and `react-dom` for the local side from the workspace and for the release from the sandbox, two copies that must not meet, and the sandbox runs React in its development mode. A gate that is not like-for-like would measure the setup and not the code.
- **The nanosecond operations** (`core/helpers`, `core/sheets`), which settle at another speed in each process and cannot be told from a change (see "Noise" above), and the memory figures, which are never compared.

### The baseline tag

The release `previous` installs is named in one place, `bench/gate/baseline.ts`: `BASELINE_TAG`, now `alpha`, because `latest` of each package is an empty placeholder until the first stable release. After that release, change that one line to `'latest'`. Every gate file reads its install spec from there.

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

- Nothing here runs in a real browser or on a device. jsdom's DOM and Node's V8 are not what a user's browser or phone runs, so an absolute figure is not a promise about a page.
- The React Native binding is measured against a stand-in for the platform, so what the platform does with a style is not in it.
- The module overhead above is not removed, and the size of it was not measured.
- The memory figures count the heap of one Node process. A browser's style sheet keeps its own copy of each rule outside it.
- The development checks are measured as one pass over 100 elements in jsdom. In a browser the pass has a different cost, and the option `hasDevChecks` itself costs nothing in the other benchmarks, because the check runs from a timer that a synchronous operation never lets fire.
