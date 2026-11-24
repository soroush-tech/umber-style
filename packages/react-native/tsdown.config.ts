import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { index: 'src/index.ts', animated: 'src/animated.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  unbundle: true,
  clean: true,
})
