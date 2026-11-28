import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { index: 'src/index.ts', internal: 'src/internal.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // Shared code keeps its own export names, so the entries re-export it unrenamed: a renamed re-export
  // makes Turbopack add a module per imported name, which put an extra chunk in the first HTML (#84).
  outputOptions: { minifyInternalExports: false },
})
