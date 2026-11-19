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

For each case it prints the ratio of the second run to the first in operations per second: below 1 the case got slower. A case below the lower threshold is marked `SLOWER` and a case above the upper one `faster`; a case that only one file has is `added` or `removed`. The exit code is 1 when any case is `SLOWER`, 2 for a wrong call, and 0 otherwise. The continuous integration gate that a later step adds uses this command. The logic is in `bench/src/compare.ts`, with its unit tests.

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
- A threshold of 0.8 is meant to catch a change of a quarter in a case that is steady. Do not gate on a case that is listed as noisy.

## Noise of two runs

Two runs of the whole suite, one after the other on one Windows laptop (Node 26, vitest 5.1.1, `BENCH_TIME` 200) with other programs open, gave these ratios of the second run to the first, over the 139 cases:

| Package        | Cases | Median ratio | Lowest | Highest | Cases within 0.9 to 1.1 |
| -------------- | ----- | ------------ | ------ | ------- | ----------------------- |
| `core`         | 58    | 0.92         | 0.41   | 1.64    | 25                      |
| `react`        | 65    | 0.94         | 0.44   | 1.64    | 26                      |
| `vue`          | 7     | 0.91         | 0.72   | 1.51    | 1                       |
| `react-native` | 9     | 0.76         | 0.65   | 1.54    | 1                       |

80 of the 139 cases were within the default thresholds of 0.8 and 1.25, and `pnpm bench:compare` between the two runs exited 1 with 42 cases below 0.8. The margin of error each run printed (mostly 1% to 10%) was far smaller than that: it does not cover what the machine did between the runs. The cases that moved most (below 0.5 or above 1.5) were the start-up reads, the theme classes made for a new object, and the first and small cases of the React server render, the DOM render of the same props, and the React Native object sheet. Do not gate on a case from a laptop in this state: use a quiet machine, a larger `BENCH_TIME`, and compare against a run made just before on the same machine.

## Whole pages

These benchmarks measure parts. The numbers of a whole page (first HTML, hydration, the size of the CSS, a Lighthouse run) come from the end-to-end fixtures: see [Testing](testing.md), tier 3.

## Limits

- Nothing here runs in a real browser or on a device. jsdom's DOM and Node's V8 are not what a user's browser or phone runs, so an absolute figure is not a promise about a page.
- The React Native binding is measured against a stand-in for the platform, so what the platform does with a style is not in it.
- The module overhead above is not removed, and the size of it was not measured.
- The memory figures count the heap of one Node process. A browser's style sheet keeps its own copy of each rule outside it.
- The development checks are measured as one pass over 100 elements in jsdom. In a browser the pass has a different cost, and the option `hasDevChecks` itself costs nothing in the other benchmarks, because the check runs from a timer that a synchronous operation never lets fire.
