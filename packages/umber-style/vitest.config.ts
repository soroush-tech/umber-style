import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vitest/config'

const standIn = fileURLToPath(new URL('./vitest.react-native.ts', import.meta.url))
/** A file of the animation library or of its worklets runtime, in the store of pnpm. */
const LIBRARY_FILE = /[\\/]node_modules[\\/].*react-native-(?:reanimated|worklets)[\\/]/

/**
 * Where the platform and the animation library resolve, as in the tests of the React Native binding: the
 * platform is a stand-in, for the library's own code too, and the library is its official mock (see
 * `packages/react-native/vitest.config.ts`).
 */
const platform: Plugin = {
  name: 'platform',
  enforce: 'pre',
  async resolveId(source, importer) {
    const isLibrary = importer !== undefined && LIBRARY_FILE.test(importer)
    if (source === 'react-native') return standIn
    if (source === 'react-native-reanimated' && !isLibrary) {
      return this.resolve('react-native-reanimated/src/mock', importer, { skipSelf: true })
    }
    if (!isLibrary || source.startsWith('.')) return null
    return (await this.resolve(source, importer, { skipSelf: true })) ?? standIn
  },
}

export default defineConfig({
  plugins: [platform],
  resolve: {
    alias: [
      // The entry that the type tests import by its package name: at run time it is the web binding.
      {
        find: /^umber-style\/react$/,
        replacement: fileURLToPath(new URL('./src/react.ts', import.meta.url)),
      },
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    // The globals the animation library reads, set as in the tests of the React Native binding.
    setupFiles: ['../react-native/vitest.setup.ts'],
    server: { deps: { inline: [/react-native-(?:reanimated|worklets)/] } },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      thresholds: { 100: true },
    },
  },
})
