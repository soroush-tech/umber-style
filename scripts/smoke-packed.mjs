// Proves that the publishable packages work as npm will hand them out, not as the workspace sees them.
//
//   pnpm build && node scripts/smoke-packed.mjs [--keep]
//
// It packs each package with `pnpm pack` (which applies `publishConfig`, as `pnpm publish` does),
// inspects each tarball, installs them all together into a temporary folder outside the workspace
// with npm, and then checks, from there:
//   - every entry and subpath loads with `import` and with `require`, and both give the same names;
//   - the `react-server` condition gives the server build (`useTheme` and `readTheme`, no
//     `ThemeContext`), the `react-native` condition gives the React Native binding for
//     `umber-style/react`;
//   - the bindings and the umbrella share one copy of the core;
//   - a styled React component renders on the server with a class and its CSS;
//   - TypeScript resolves the declarations of every entry under `moduleResolution` bundler and
//     node16, with `skipLibCheck` off, including a styled component with a typed theme.
// `react-native` cannot be loaded by Node, so a stand-in package with the two values the binding
// imports takes its place; the real types of `react-native` are covered by the workspace typecheck.
// The temporary folder is removed at the end, unless `--keep` is given. Needs the network (npm).
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const keep = process.argv.includes('--keep')
// Where each package lives, in the order they are published.
const PACKAGES = [
  { dir: 'core', name: '@umber-style/core' },
  { dir: 'cache', name: '@umber-style/cache' },
  { dir: 'server', name: '@umber-style/server' },
  { dir: 'css', name: '@umber-style/css' },
  { dir: 'react', name: '@umber-style/react' },
  { dir: 'styled', name: '@umber-style/styled' },
  { dir: 'react-native', name: '@umber-style/react-native' },
  { dir: 'vue', name: '@umber-style/vue' },
  { dir: 'umber-style', name: 'umber-style' },
]
// The names every entry of the package must export, and that the ESM and CJS builds must agree on.
const ENTRIES = {
  '@umber-style/core': ['createEngine', 'createCache', 'extractPageStyles', 'at'],
  '@umber-style/cache': ['default'],
  '@umber-style/server/create-instance': ['default'],
  '@umber-style/css': [
    'css',
    'cx',
    'keyframes',
    'injectGlobal',
    'cache',
    'sheet',
    'flush',
    'hydrate',
    'getRegisteredStyles',
    'merge',
  ],
  '@umber-style/css/create-instance': [],
  '@umber-style/react': [
    'createStyle',
    'styled',
    'ThemeProvider',
    'useTheme',
    'StyleSheet',
    'at',
    'Global',
    'keyframes',
    'css',
  ],
  '@umber-style/styled': ['default'],
  '@umber-style/react-native': [
    'createStyle',
    'styled',
    'ThemeProvider',
    'useTheme',
    'StyleSheet',
    'Global',
    'keyframes',
    'css',
  ],
  '@umber-style/vue': [
    'createStyle',
    'styled',
    'ThemeProvider',
    'useTheme',
    'StyleSheet',
    'Global',
    'keyframes',
    'css',
  ],
  'umber-style': ['createEngine', 'createCache', 'extractPageStyles'],
  'umber-style/react': [
    'createStyle',
    'styled',
    'ThemeProvider',
    'StyleSheet',
    'Global',
    'keyframes',
    'css',
  ],
  'umber-style/react-native': [
    'createStyle',
    'styled',
    'ThemeProvider',
    'useTheme',
    'Global',
    'css',
  ],
  'umber-style/vue': ['createStyle', 'styled', 'ThemeProvider', 'useTheme', 'Global', 'css'],
}

const windows = process.platform === 'win32'
const failures = []
const fail = (message) => {
  failures.push(message)
  console.error(`FAIL ${message}`)
}
const pass = (message) => console.log(`ok   ${message}`)
const check = (condition, message) => (condition ? pass(message) : fail(message))

/**
 * Runs a command; the output goes to the console only when it fails. On Windows npm, npx and pnpm
 * are scripts, which only a shell starts: the line is quoted here, as one string.
 */
const run = (command, args, options = {}) => {
  const shell = windows && ['npm', 'npx', 'pnpm'].includes(command)
  const result = shell
    ? spawnSync([command, ...args.map((arg) => JSON.stringify(arg))].join(' '), {
        encoding: 'utf8',
        shell: true,
        ...options,
      })
    : spawnSync(command, args, { encoding: 'utf8', ...options })
  return { ok: result.status === 0, out: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}
const must = (result, what) => {
  if (result.ok) return result.out
  console.error(result.out)
  throw new Error(`${what} failed`)
}

/** Every string in a package.json field (an exports map, a path), with its place. */
const leaves = (value, place = []) =>
  typeof value === 'string'
    ? [{ place: place.join('.'), path: value }]
    : Object.entries(value ?? {}).flatMap(([key, child]) => leaves(child, [...place, key]))

for (const { dir } of PACKAGES) {
  if (!existsSync(join(repoRoot, 'packages', dir, 'dist'))) {
    console.error(`packages/${dir}/dist is missing: run \`pnpm build\` first.`)
    process.exit(1)
  }
}

const work = mkdtempSync(join(tmpdir(), 'umber-smoke-'))
const tarballs = join(work, 'tarballs')
const extracted = join(work, 'extracted')
const consumer = join(work, 'consumer')
mkdirSync(tarballs)
mkdirSync(extracted)
mkdirSync(consumer)

try {
  // 1. Pack, and inspect what is in each tarball.
  const files = {}
  for (const { dir, name } of PACKAGES) {
    must(
      run('pnpm', ['pack', '--pack-destination', tarballs], {
        cwd: join(repoRoot, 'packages', dir),
      }),
      `pnpm pack ${name}`
    )
    const file = readdirSync(tarballs).find(
      (entry) => !Object.values(files).includes(entry) && entry.endsWith('.tgz')
    )
    files[name] = file
    const into = join(extracted, dir)
    mkdirSync(into)
    // Relative paths: a drive letter in an argument makes GNU tar look for a remote host.
    must(run('tar', ['-xzf', file, '-C', `../extracted/${dir}`], { cwd: tarballs }), `tar ${file}`)
    const root = join(into, 'package')
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    const paths = [
      ...leaves(pkg.exports),
      ...['main', 'module', 'types'].map((key) => ({ place: key, path: pkg[key] })),
    ]
    check(pkg.private !== true, `${name}: not private`)
    check(
      paths.every(({ path }) => path.startsWith('./dist/')),
      `${name}: exports, main, module and types all point at dist`
    )
    check(
      paths.every(({ path }) => existsSync(join(root, path))),
      `${name}: every file that exports names is in the tarball`
    )
    check(!JSON.stringify(pkg).includes('/src/'), `${name}: no reference to src`)
    check(
      existsSync(join(root, 'LICENSE')) && existsSync(join(root, 'README.md')),
      `${name}: LICENSE and README.md are in the tarball`
    )
    check(
      !JSON.stringify(pkg.dependencies ?? {}).includes('workspace:') &&
        !JSON.stringify(pkg.peerDependencies ?? {}).includes('workspace:'),
      `${name}: no workspace range left in its dependencies`
    )
    const other = readdirSync(root).filter(
      (entry) => !['dist', 'LICENSE', 'README.md', 'package.json'].includes(entry)
    )
    check(
      other.length === 0,
      `${name}: the tarball holds only dist, LICENSE, README.md, package.json`
    )
  }

  // 2. A consumer outside the workspace: the tarballs, resolving each other, and their peers.
  const version = (dir, field, name) =>
    JSON.parse(readFileSync(join(repoRoot, 'packages', dir, 'package.json'), 'utf8'))[field][name]
  const direct = Object.fromEntries(
    Object.entries(files).map(([name, file]) => [name, `file:./tarballs/${file}`])
  )
  mkdirSync(join(consumer, 'tarballs'))
  for (const file of Object.values(files))
    cpSync(join(tarballs, file), join(consumer, 'tarballs', file))
  // The stand-in for `react-native`, which Node cannot load.
  const stub = join(consumer, 'react-native-stub')
  mkdirSync(stub)
  writeFileSync(
    join(stub, 'package.json'),
    JSON.stringify({
      name: 'react-native',
      version: '0.88.1',
      main: 'index.js',
      types: 'index.d.ts',
    })
  )
  writeFileSync(
    join(stub, 'index.js'),
    [
      'exports.Appearance = { getColorScheme: () => "light", addChangeListener: () => ({ remove() {} }) }',
      'exports.StyleSheet = { create: (styles) => styles, flatten: (style) => style, hairlineWidth: 1 }',
      'exports.Dimensions = { get: () => ({ width: 400, height: 800, scale: 1, fontScale: 1 }), addEventListener: () => ({ remove() {} }) }',
      'exports.AccessibilityInfo = { isReduceMotionEnabled: () => Promise.resolve(false), addEventListener: () => ({ remove() {} }) }',
      '',
    ].join('\n')
  )
  writeFileSync(
    join(stub, 'index.d.ts'),
    [
      'export interface ViewStyle { padding?: number | string; margin?: number | string; backgroundColor?: string; opacity?: number; color?: string }',
      'export interface TextStyle extends ViewStyle { fontSize?: number }',
      'export interface ImageStyle extends ViewStyle { resizeMode?: string }',
      'export const Appearance: { getColorScheme(): "light" | "dark" | null | undefined; addChangeListener(listener: (preferences: { colorScheme: "light" | "dark" | null | undefined }) => void): { remove(): void } }',
      'export const StyleSheet: { create<T>(styles: T): T; flatten<T>(style: T): T; hairlineWidth: number }',
      'export const Dimensions: { get(dimension: string): { width: number; height: number; scale: number; fontScale: number }; addEventListener(type: "change", handler: Function): { remove(): void } }',
      'export const AccessibilityInfo: { isReduceMotionEnabled(): Promise<boolean>; addEventListener(eventName: "reduceMotionChanged", handler: (isEnabled: boolean) => void): { remove(): void } }',
      '',
    ].join('\n')
  )
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify(
      {
        name: 'umber-smoke-consumer',
        private: true,
        dependencies: {
          ...direct,
          react: version('react', 'devDependencies', 'react'),
          'react-dom': version('react', 'devDependencies', 'react-dom'),
          vue: version('vue', 'devDependencies', 'vue'),
          'react-native': 'file:./react-native-stub',
          '@types/react': version('react', 'devDependencies', '@types/react'),
          '@types/node': version('react', 'devDependencies', '@types/node'),
          typescript: version('react', 'devDependencies', 'typescript'),
        },
        // The tarballs name each other with exact versions that npm does not hold yet: resolve
        // them to the tarballs given above.
        overrides: Object.fromEntries(Object.keys(files).map((name) => [name, `$${name}`])),
      },
      null,
      2
    )
  )
  must(
    run('npm', ['install', '--no-audit', '--no-fund', '--ignore-scripts'], { cwd: consumer }),
    'npm install in the consumer'
  )
  pass('the tarballs install together with react, react-dom and vue')

  // One copy of the core on disk.
  const nested = PACKAGES.filter(({ dir }) => dir !== 'core').filter(({ name }) =>
    existsSync(
      join(consumer, 'node_modules', ...name.split('/'), 'node_modules', '@umber-style', 'core')
    )
  )
  check(nested.length === 0, 'one copy of @umber-style/core is installed')

  // 3. Node: import and require of every entry, in one script for each format.
  const body = (format) => `
const results = {}
const need = async (specifier, names) => {
  const mod = await load(specifier)
  const exported = Object.keys(mod).filter((key) => key !== 'default' && key !== '__esModule').sort()
  const missing = names.filter((name) => !(name in mod))
  if (missing.length) throw new Error(specifier + ' lacks ' + missing.join(', '))
  results[specifier] = exported
  return mod
}
const entries = ${JSON.stringify(ENTRIES)}
const mods = {}
for (const [specifier, names] of Object.entries(entries)) mods[specifier] = await need(specifier, names)
// One engine: the bindings and the umbrella hand out the very functions of the one core.
const same = (a, b, what) => { if (a !== b) throw new Error('two copies: ' + what) }
same(mods['umber-style'].createEngine, mods['@umber-style/core'].createEngine, 'umber-style and core')
same(mods['@umber-style/react'].at, mods['@umber-style/core'].at, 'react and core')
same(mods['umber-style/react'].styled, mods['@umber-style/react'].styled, 'umber-style/react and react')
same(mods['@umber-style/styled'].default, mods['@umber-style/react'].styled, '@umber-style/styled and react')
same(mods['umber-style/react-native'].styled, mods['@umber-style/react-native'].styled, 'umber-style/react-native')
same(mods['umber-style/vue'].styled, mods['@umber-style/vue'].styled, 'umber-style/vue')
// The plain layer: a class name from a style, its rule in the cache, and a separate instance.
const plain = mods['@umber-style/css']
const card = plain.css({ padding: 8 })
if (!plain.cache.extract().css.includes('.' + card + '{padding:8px;}')) throw new Error('no rule for ' + card)
const createInstance = mods['@umber-style/css/create-instance'].default
if (!createInstance({ key: 'plain' }).css({ color: 'red' }).startsWith('plain-')) throw new Error('no class from create-instance')
// Server rendering of a styled component: a class, and its CSS.
const React = await load('react')
const { renderToStaticMarkup } = await load('react-dom/server')
const { createStyle } = mods['@umber-style/react']
const theme = { palette: { primary: '#1b5fd1' }, space: [0, 4, 8] }
const { styled, ThemeProvider, cache } = createStyle(theme, { prefix: 'smoke', hasServerStyleElements: false })
const Box = styled('div', { name: 'Box' })(({ theme: view }) => ({ color: view.palette.primary, padding: view.space[1] }))
const html = renderToStaticMarkup(React.createElement(ThemeProvider, { theme }, React.createElement(Box, null, 'x')))
const match = /class="[^"]*(smoke-box-root-\\w+)/.exec(html)
if (!match) throw new Error('no class in ' + html)
if (html.includes('style=')) throw new Error('an inline style in ' + html)
const { css } = cache.extract()
if (!css.includes('.' + match[1] + '{color:var(--smoke-palette-primary);')) throw new Error('no rule for ' + match[1] + ' in ' + css)
if (!css.includes('--smoke-palette-primary:#1b5fd1;')) throw new Error('no token in ' + css)
results.html = html
// The cache package and the server functions over it: a page's CSS as data-umber tags.
const umberCache = mods['@umber-style/cache'].default({ key: 'smoke' })
const page = createStyle(theme, { cache: umberCache, hasServerStyleElements: false })
const Card = page.styled('div', { name: 'Card' })({ margin: 2 })
const cardHtml = renderToStaticMarkup(React.createElement(Card, null, 'x'))
const tags = mods['@umber-style/server/create-instance'].default(umberCache).renderStylesToString(cardHtml)
if (!/^<style data-umber="smoke-global">@layer [^<]+<\\/style><style data-umber="smoke smoke-card-root-\\w+">@layer smoke-components/.test(tags)) throw new Error('no data-umber tags in ' + tags)
${format === 'esm' ? "const { writeFileSync } = await import('node:fs')" : "const { writeFileSync } = require('node:fs')"}
writeFileSync('keys-${format}.json', JSON.stringify(results, null, 2))
`
  writeFileSync(
    join(consumer, 'check.mjs'),
    `const load = (specifier) => import(specifier)\n${body('esm')}`
  )
  writeFileSync(
    join(consumer, 'check.cjs'),
    `const load = async (specifier) => require(specifier)\n;(async () => {${body('cjs')}})().catch((error) => { console.error(error); process.exit(1) })\n`
  )
  const esm = run('node', ['check.mjs'], { cwd: consumer })
  check(esm.ok, 'ESM: every entry loads, one core, a styled component renders')
  if (!esm.ok) console.error(esm.out)
  const cjs = run('node', ['check.cjs'], { cwd: consumer })
  check(cjs.ok, 'CJS: every entry loads, one core, a styled component renders')
  if (!cjs.ok) console.error(cjs.out)
  if (esm.ok && cjs.ok) {
    const a = JSON.parse(readFileSync(join(consumer, 'keys-esm.json'), 'utf8'))
    const b = JSON.parse(readFileSync(join(consumer, 'keys-cjs.json'), 'utf8'))
    for (const specifier of Object.keys(ENTRIES)) {
      check(
        JSON.stringify(a[specifier]) === JSON.stringify(b[specifier]),
        `${specifier}: import and require give the same names (${a[specifier].length})`
      )
    }
    check(a.html === b.html, 'the server render is the same from import and from require')
  }

  // 4. The export conditions.
  writeFileSync(
    join(consumer, 'conditions.mjs'),
    `
const [, , expected] = process.argv
const names = async (specifier) => Object.keys(await import(specifier))
const react = await names('@umber-style/react')
const shared = await names('umber-style/react')
const styledDefault = (await import('@umber-style/styled')).default
if (styledDefault !== (await import('@umber-style/react')).styled) throw new Error('@umber-style/styled is not the styled of @umber-style/react')
if (expected === 'server') {
  for (const keys of [react, shared]) {
    if (!keys.includes('readTheme') || !keys.includes('useTheme') || keys.includes('ThemeContext')) throw new Error('not the server build: ' + keys)
  }
} else if (expected === 'native') {
  const web = await import('@umber-style/react')
  const native = await import('@umber-style/react-native')
  const umbrella = await import('umber-style/react')
  if (umbrella.styled !== native.styled || web.styled === native.styled) throw new Error('not the React Native binding')
} else if (react.includes('readTheme') || !react.includes('useTheme') || !shared.includes('useTheme')) {
  throw new Error('not the client build: ' + react)
}
`
  )
  const cjsConditions = `
const keys = (specifier) => Object.keys(require(specifier))
const expected = process.argv[2]
const react = keys('@umber-style/react')
const shared = keys('umber-style/react')
if (require('@umber-style/styled').default !== require('@umber-style/react').styled) throw new Error('@umber-style/styled is not the styled of @umber-style/react')
if (expected === 'server') {
  for (const names of [react, shared]) {
    if (!names.includes('readTheme') || !names.includes('useTheme') || names.includes('ThemeContext')) throw new Error('not the server build: ' + names)
  }
} else if (expected === 'native') {
  if (require('umber-style/react').styled !== require('@umber-style/react-native').styled) throw new Error('not the React Native binding')
} else if (react.includes('readTheme') || !react.includes('useTheme')) {
  throw new Error('not the client build: ' + react)
}
`
  writeFileSync(join(consumer, 'conditions.cjs'), cjsConditions)
  for (const [expected, flags, what] of [
    ['client', [], 'no condition: the client build'],
    ['server', ['--conditions=react-server'], 'react-server: the server build'],
    [
      'native',
      ['--conditions=react-native'],
      'react-native: umber-style/react is the React Native binding',
    ],
  ]) {
    for (const [file, label] of [
      ['conditions.mjs', 'import'],
      ['conditions.cjs', 'require'],
    ]) {
      const result = run('node', [...flags, file, expected], { cwd: consumer })
      check(result.ok, `${label}, ${what}`)
      if (!result.ok) console.error(result.out)
    }
  }

  // 5. TypeScript: every entry, bundler and node16 resolution, no skipLibCheck.
  const typed = `
import { createEngine } from '@umber-style/core'
import type { Theme } from '@umber-style/core'
import { css, cx } from '@umber-style/css'
import createCssInstance from '@umber-style/css/create-instance'
import { createStyle } from '@umber-style/react'
import type { CSSObject, Keyframes, SerializedStyles } from '@umber-style/react'
import styled from '@umber-style/styled'
import type { FilteringStyledOptions, StyledOptions } from '@umber-style/styled'
import { createStyle as createNative } from '@umber-style/react-native'
import { createStyle as createVue } from '@umber-style/vue'
import { createEngine as createUmbrellaEngine } from 'umber-style'
import createCache from '@umber-style/cache'
import type { UmberCache } from '@umber-style/cache'
import createInstance from '@umber-style/server/create-instance'
import { createStyle as createShared } from 'umber-style/react'
import { createStyle as createUmbrellaNative } from 'umber-style/react-native'
import { createStyle as createUmbrellaVue } from 'umber-style/vue'

const theme = { palette: { primary: '#1b5fd1', onPrimary: '#ffffff' }, space: [0, 4, 8] }

export const engine = createEngine(theme)
export const umbrellaEngine = createUmbrellaEngine(theme)
export const umberCache: UmberCache = createCache({ key: 'smoke' })
export const tags: string = createInstance(umberCache).constructStyleTagsFromChunks(
  createInstance(umberCache).extractCriticalToChunks('<p></p>')
)
export const base: Theme | undefined = undefined
export const plainClass: string = cx(css({ padding: 4 }), false, { open: true })
export const ownClass: string = createCssInstance({ key: 'typed' }).css\`color: red;\`

const web = createStyle(theme, { prefix: 'smoke' })
export const Box = web.styled('div', { name: 'Box' })(({ theme: view }) => {
  const primary: string = view.palette.primary
  // @ts-expect-error the theme has no palette.missing
  const missing = view.palette.missing
  return { color: primary, padding: view.space[1], opacity: missing ? 1 : 0.5 }
})
export const color: string = web.useTheme().palette.primary
const styledOptions: StyledOptions = { name: 'Card', target: 'card' }
export const Card = styled('section', styledOptions)({ padding: 4 })
export const Label = styled.span<{ tone?: string }>(({ tone }) => ({ color: tone }))
const cardStyle: CSSObject = { padding: 4, '&:hover': { opacity: 0.8 } }
export const card: SerializedStyles = web.css(cardStyle)
export const fade: Keyframes = web.keyframes\`from { opacity: 0; }\`
export const Title = web.styled('h1')<{ tone: string }>\`
  color: \${({ tone }) => tone};
\`
const linkOptions = {
  shouldForwardProp: (prop: string): prop is 'href' => prop === 'href',
} satisfies FilteringStyledOptions<{ href?: string }, 'href'>
export const Link = styled('a', linkOptions)({ color: 'red' })

const native = createNative(theme)
export const nativeColor: string = native.useTheme().palette.primary
export const nativeSheet = native.StyleSheet.create({ box: { padding: 4 } })

const vue = createVue(theme)
export const vueColor: string = vue.useTheme().value.palette.primary

const shared = createShared(theme)
export const sharedColor: string = shared.useTheme().palette.primary
export const SharedBox = shared.styled('div')(({ theme: view }) => ({ padding: view.space[1] }))
export const umbrellaNative = createUmbrellaNative(theme).useTheme().palette.primary
export const umbrellaVue = createUmbrellaVue(theme).useTheme().value.palette.primary
`
  const server = `
import * as web from '@umber-style/react'
import styled from '@umber-style/styled'
import { createStyle } from 'umber-style/react'

const theme = { palette: { primary: '#1b5fd1' } }
export const read: () => object = web.readTheme
export const base: () => object = web.useTheme
// @ts-expect-error the server build has no context
export const context = web.ThemeContext
export const shared: { palette: { primary: string } } = createStyle(theme).useTheme()
export const sharedRead: { palette: { primary: string } } = createStyle(theme).readTheme()
export const ServerBox = styled.div({ padding: 4 })
`
  const ts = join(consumer, 'ts')
  mkdirSync(ts)
  writeFileSync(join(ts, 'entries.ts'), typed)
  writeFileSync(join(ts, 'entries.mts'), typed)
  writeFileSync(join(ts, 'entries.cts'), typed)
  writeFileSync(join(ts, 'server.ts'), server)
  const options = {
    strict: true,
    noEmit: true,
    skipLibCheck: false,
    lib: ['ES2023', 'DOM'],
    types: ['node'],
    jsx: 'react-jsx',
  }
  for (const [file, compilerOptions, include, what] of [
    [
      'tsconfig.bundler.json',
      { ...options, module: 'esnext', moduleResolution: 'bundler' },
      ['ts/entries.ts'],
      'moduleResolution bundler',
    ],
    [
      'tsconfig.node16.json',
      { ...options, module: 'node16', moduleResolution: 'node16' },
      ['ts/entries.mts', 'ts/entries.cts'],
      'moduleResolution node16, from an ES module and from a CommonJS file',
    ],
    [
      'tsconfig.server.json',
      {
        ...options,
        module: 'esnext',
        moduleResolution: 'bundler',
        customConditions: ['react-server'],
      },
      ['ts/server.ts'],
      'the react-server condition: useTheme and readTheme, and no ThemeContext',
    ],
  ]) {
    writeFileSync(join(consumer, file), JSON.stringify({ compilerOptions, include }, null, 2))
    const result = run('npx', ['--no-install', 'tsc', '-p', file], { cwd: consumer })
    check(result.ok, `types: ${what}`)
    if (!result.ok) console.error(result.out)
  }
} finally {
  if (keep) console.log(`kept ${work}`)
  else rmSync(work, { recursive: true, force: true })
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed.`)
  process.exit(1)
}
console.log('\nThe packed packages work from outside the workspace.')
