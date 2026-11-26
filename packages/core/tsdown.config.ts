import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { index: 'src/index.ts', internal: 'src/internal.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
})
