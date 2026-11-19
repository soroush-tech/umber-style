// pnpm bench:gate --base <dir> --head <dir> [--rounds n] [--threshold x] [--out dir]
// Measures the base and the head checkouts in interleaved rounds on this machine and fails when a gated
// case is slower in the head. The logic is in ../src/gate.ts, which has its tests; this file only gives it
// the machine: it starts `bench/bin/run.mjs` of each checkout, so each side runs its own suite.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const { runGate } = await import('../src/gate.ts')
const { GATE_CONFIG, GATE_SUITE } = await import('../src/gate-config.ts')

const root = fileURLToPath(new URL('../..', import.meta.url))

process.exitCode = runGate(
  process.argv.slice(2),
  GATE_CONFIG,
  join(root, 'bench', 'results', 'gate'),
  {
    hasSuite: (dir) => existsSync(join(resolve(dir), 'bench', 'bin', 'run.mjs')),
    runSuite: (dir, outDir) => {
      mkdirSync(outDir, { recursive: true })
      return (
        spawnSync(
          process.execPath,
          [join(resolve(dir), 'bench', 'bin', 'run.mjs'), ...GATE_SUITE.files],
          {
            cwd: resolve(dir),
            stdio: 'inherit',
            env: { ...GATE_SUITE.env, ...process.env, BENCH_OUT_DIR: resolve(outDir) },
          }
        ).status ?? 1
      )
    },
    readResult: (path) => JSON.parse(readFileSync(path, 'utf8')),
    writeText: (path, text) => {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, text)
    },
    write: (line) => console.log(line),
  }
)
