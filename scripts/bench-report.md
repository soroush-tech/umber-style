# bench-report.mjs

## What it does

`node scripts/bench-report.mjs <name>@<version> ... [--rounds <n>] [--summary <file>] [--release]` makes
the benchmark report after a release. For each `name@version` given:

1. A package with no report scenarios (all but `@umber-style/core`: `SCENARIOS`) gets a line that says so.
2. It waits until the npm registry lists the version: 30 tries, 10 seconds apart. When it never does, the
   package gets a line that says so and the run will exit 1.
3. `planReport` (`bench/src/releases.ts`) picks the versions to compare from the registry's list: the
   last stable, and for a prerelease the previous release of its channel for the same version;
   `createColumns` (`bench/src/reportTable.ts`) makes them the columns of the table. With nothing to
   compare (a first release) the package gets a line that says so, and nothing else.
4. It writes the versions into `bench/report/versions.json` and runs each `bench/report/*.bench.ts` with
   the soroush-bench CLI, one after the other: `--rounds <n>` (5 by default) and `--json-file` into a
   writable temporary folder mounted at `/out`. No gate runs.
5. A file counts as run when the tool exits with 0 and its JSON came back with every version: its row is
   `createReportRow` of that JSON, the median time of every version and, for every version but the
   baseline, the speed against it. Any other file has no row, and the run will exit 1.
6. It prints the markdown table, appends it to `--summary` when given, and with `--release` puts it
   below the notes of the GitHub Release `<name>@<version>`, in place of a table a run before put there.

Exit code 0 when every package with scenarios got its table or had nothing to compare; 1 otherwise.

## Why it exists

The owner asked for a table after each release that says how the published version compares with the
last stable (and a prerelease with the previous one of its channel), with every version installed from npm
the same way. `.github/workflows/cd-packages.yml` runs it in the `bench-report` job, which may fail
without failing the release.

## The logic

```mermaid
flowchart TD
  specs["name@version ..."] --> has{"package has report scenarios?"}
  has -->|no| noScen["line: no report"]
  has -->|yes| wait["wait for the registry to list the version"]
  wait --> listed{"listed within 30 tries?"}
  listed -->|no| late["line: not listed; exit code 1 later"]
  listed -->|yes| plan["planReport(registry versions, version)"]
  plan --> base{"a baseline?"}
  base -->|no| first["line: nothing to compare"]
  base -->|yes| write["write bench/report/versions.json"]
  write --> run["each report file: soroush-bench --rounds --json-file"]
  run --> read["exit code 0 and the JSON back?"]
  read --> whole{"every version in the JSON?"}
  whole -->|no| missing["no row; exit code 1 later"]
  whole -->|yes| row["a row"]
  row --> table["the table"]
  missing --> table
  table --> out["stdout, --summary file"]
  table --> rel{"--release and a row?"}
  rel -->|yes| gh["gh release view; cut at the marker; append; gh release edit"]
```

## The data

- `versions.json`: `{ "package": "@umber-style/core", "versions": ["0.1.0", "0.2.0-alpha.0", "0.2.0-alpha.1"] }`,
  oldest first.
- A row: the config name of the file (the label before `::` in the tool's table), then one cell per
  version: the median mean time, and for every version but the baseline the speed against it in brackets
  (`baseline.avg / case.avg`, as soroush-bench prints it: above 100% is faster).
- The marker `<!-- umber-style benchmark report -->` separates the notes of a Release from the table.

## What it guarantees

- Every time in the table is soroush-bench's: the median of the rounds of each case, from its JSON. The
  ratio is its gate's formula, `baseline.avg / version.avg`, worked out from those numbers
  (`createReportRow`), with `us` for the micro sign.
- A rerun replaces the table in a Release; the notes above the marker are kept as they are, and
  `release-notes/<version>.md` is not touched.
- The files run one at a time.

## Decisions

- **The numbers come from `--json-file`, and no gate runs.** Until soroush-bench 2.3.0 the only place
  the ratio of every case was printed was the gate's message for the cases below a target, so the script
  asked for a target no case could reach and parsed the printed lines. The JSON has the raw means; its
  `ratioPct` needs `--baseline-case`, which the tool takes only with a positive `--min-ratio`, so the
  ratio is divided from the means instead (`bench/src/reportTable.ts`). With no gate the tool's exit code
  says whether the file ran, and it is read.
- **Not `soroush-tech/bench-action`.** Its 1.2.0 writes the same JSON and a markdown report, and skips its
  comment where there is no pull request, but it refuses a `min-ratio` that is not above 0: as a report
  that must never fail on a ratio it would need a made-up small target, and a case below it would fail the
  step. The script keeps the CLI.
- **Only the core has scenarios.** The gate scenarios are the core's; no binding has a gate-style scenario
  (the binding files compare cases within one build, and load React or Vue from the workspace).
- **The Release is edited here, not in the workflow**, so that the marker, the replace on a rerun and the
  table are in one place.

## Limits

- It needs Docker, the network, and, with `--release`, `gh` and a token that may edit Releases.
- A report made long after a release compares with what the registry lists then, filtered by version
  order (`planReport` takes only older versions).
- The times are from one runner; a report compares versions measured in one job, not two jobs.
- It has no test of its own; the choice of versions is tested in `bench/src/releases.test.ts`, and the
  table in `bench/src/reportTable.test.ts`.
