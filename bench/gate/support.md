# support.ts

## What it does

What the gate files and the report files share:

- `Scenario`: a scenario's name (the label of its config) and `build(core)`, which makes the cache, the
  inputs and any warm-up for one build of the core and returns the operation that is timed.
- `createSide(scenario, select)`: one case of a scenario. The first time it runs, it takes its module from
  `select` (given the context soroush-bench passes to a case) and builds the operation; every call after
  that runs the operation.
- `createGate(scenario)`: the config of a gate file. It loads two builds of the core by path, with
  `require`, when the file loads: `current` is `packages/core/dist/index.cjs` of this tree, `previous` is
  the same file under `PREVIOUS_DIR`, which `bench/bin/previous.mjs` built from the tag of the last
  release.

## Why it exists

The gate compares the same operation on two builds of the core, and the report after a release on
several published versions. If two sides shared a cache, a theme or an input object, one would warm what
the other measures; building lazily and per side keeps the state apart, and the operation is made once,
so the timed call is only the operation. Loading both builds of the gate the same way (a file in the
mount, required by path) is the point of the local-against-local gate: a loader that differs between the
sides shows as a difference in speed.

## The logic

```mermaid
flowchart TD
  gate["createGate(scenario), at file load"] --> loadCurrent["require packages/core/dist/index.cjs"]
  gate --> loadPrevious["require PREVIOUS_DIR/packages/core/dist/index.cjs"]
  loadCurrent --> missing{"loaded?"}
  loadPrevious --> missing
  missing -->|no| throw["throw: what to run (pnpm build, or previous.mjs)"]
  missing -->|yes| cases["cases: current, previous"]
  cases --> call["a case runs with a context"]
  call --> built{"operation made already?"}
  built -->|no| pick["select(context): this side's module"]
  pick --> make["run = scenario.build(module)"]
  make --> exec["return run()"]
  built -->|yes| exec
```

## What it guarantees

- `build` runs at most once for each side, on the first call of that side.
- The two sides never share what `build` made.
- A gate file whose builds are not both there fails when it loads, before it measures: the gate never
  passes without a comparison.
- `createGate` returns exactly the keys `current` and `previous`; the `baseline-case: previous` input of
  the `bench` job in `.github/workflows/ci.yml` and `bench/bin/gate.mjs` rely on the second name.

## Decisions

- **Both builds are read as the source's API** (`typeof import('@umber-style/core')`), so the type check
  needs no build. A release whose API differs fails when the case runs, not when it is type-checked; the
  scenarios use only what every release since 0.1.0 has.
- **`require`, not `import`**: the published package's `require` condition points at `dist/index.cjs`,
  and the report's installed versions are loaded through it too.

## Limits

- The cast of a module to the source's API is not checked.
