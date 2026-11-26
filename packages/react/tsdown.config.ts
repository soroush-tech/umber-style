import { defineConfig } from 'tsdown'

// The client build and the server build are two entries; the `react-server` export condition picks
// the second one. `next` is the entry of the Next.js registry, the one file that imports `next`.
export default defineConfig({
  entry: { index: 'src/index.ts', 'index.server': 'src/index.server.ts', next: 'src/next.tsx' },
  format: ['esm', 'cjs'],
  dts: true,
  unbundle: true,
  clean: true,
})
