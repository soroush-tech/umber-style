import { defineConfig } from 'tsdown'

// The code and the declarations of `umber-style/react` come from different files: at run time the
// entry is a re-export of the web binding (or, under the `react-native` condition, of the React
// Native binding), and for the compiler it is `shared.ts` (`shared.server.ts` under `react-server`),
// which holds the types both platforms share. Both are entries, so each gets its code and its
// declarations; the exports map points the code at one and the declarations at the other.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    react: 'src/react.ts',
    'react.server': 'src/react.server.ts',
    'react-native': 'src/react-native.ts',
    vue: 'src/vue.ts',
    shared: 'src/shared.ts',
    'shared.server': 'src/shared.server.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
})
