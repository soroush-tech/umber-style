import { defineConfig } from 'tsdown'

// The client build and the server build are two entries; the `react-server` export condition picks
// the second one.
export default defineConfig({
  entry: { index: 'src/index.ts', 'index.server': 'src/index.server.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  unbundle: true,
  clean: true,
})
