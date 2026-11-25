// How the benchmark gate judges a run, written once (`GATE_OPTIONS` in `bench/gate/baseline.ts`) and given
// in two forms: the options of the soroush-bench CLI, for `pnpm bench:gate`, and the outputs of a step,
// which the `bench` job of ci.yml passes to `soroush-tech/bench-action`.

/** How the gate judges a run. */
export interface GateOptions {
  /** The case every other case of a file is compared with. */
  baselineCase: string
  /** The slowest speed against the baseline case that passes, in percent. */
  minRatio: number
  /** How many times each file runs; the median of each case is compared. */
  rounds: number
}

/** The options of the soroush-bench CLI for `options`, as the job gives them to the action. */
export function toCliArguments({ baselineCase, minRatio, rounds }: GateOptions): string[] {
  return [
    '--baseline-case',
    baselineCase,
    '--min-ratio',
    String(minRatio),
    '--rounds',
    String(rounds),
  ]
}

/** `options` as the lines `name=value` of a step's outputs (`$GITHUB_OUTPUT`), named as the inputs of the action. */
export function toStepOutputs({ baselineCase, minRatio, rounds }: GateOptions): string {
  return `baseline-case=${baselineCase}\nmin-ratio=${minRatio}\nrounds=${rounds}\n`
}
