import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vitest/config'

const standIn = fileURLToPath(new URL('./vitest.react-native.ts', import.meta.url))
/** A file of the animation library or of its worklets runtime, in the store of pnpm. */
const LIBRARY_FILE = /[\\/]node_modules[\\/].*react-native-(?:reanimated|worklets)[\\/]/

/**
 * Where the platform and the animation library resolve in the tests. The binding's one import of the
 * platform goes to a stand-in. The animated entry's import of the library goes to the library's official
 * mock (`mock.js` of the package loads `src/mock`, which only Babel can load). The mock is built over the
 * library's own code, its files for the web, as the resolver of the library's Jest set-up picks them: its
 * imports of the platform go to the same stand-in (`vitest.library-platform.ts` has what they read), and so
 * does an import of a package that is not installed here.
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
  test: {
    globals: true,
    environment: 'jsdom',
    // The library's globals: `__DEV__`, which its bundler defines, and `matchMedia`, which jsdom lacks.
    setupFiles: ['./vitest.setup.ts'],
    // The library ships TypeScript source: it is compiled with the tests, not loaded by Node.
    server: { deps: { inline: [/react-native-(?:reanimated|worklets)/] } },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      thresholds: { 100: true },
    },
  },
})
