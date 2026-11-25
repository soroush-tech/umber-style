// node bench/bin/gate-options.mjs
// Prints how the benchmark gate judges a run (GATE_OPTIONS of bench/gate/baseline.ts) as the outputs of a
// step: the `bench` job of .github/workflows/ci.yml appends them to $GITHUB_OUTPUT and gives them to
// soroush-tech/bench-action, so that the job and `pnpm bench:gate` read one place.
import { GATE_OPTIONS } from '../gate/baseline.ts'
import { toStepOutputs } from '../src/gateOptions.ts'

process.stdout.write(toStepOutputs(GATE_OPTIONS))
