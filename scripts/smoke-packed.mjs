// Proves that the publishable packages work as npm will hand them out, not as the workspace sees them.
//
//   pnpm build && node scripts/smoke-packed.mjs [--keep]
//
// It packs each package with `pnpm pack` (which applies `publishConfig`, as `pnpm publish` does),
// inspects each tarball, installs them all together into a temporary folder outside the workspace
// with npm, and then checks, from there:
//   - every entry and subpath loads with `import` and with `require`, and both give the same names;
//   - an entry with a default export has the same function by name, and a CommonJS file that loads
//     it as a bundler's Node interop does (the default is the whole `module.exports`) gets the
//     function by that name;
//   - the `react-server` condition gives the server build (`useTheme` and `readTheme`, no
//     `ThemeContext`), the `react-native` condition gives the React Native binding for
//     `umber-style/react`;
//   - the bindings and the umbrella share one copy of the core;
//   - a styled React component renders on the server with a class and its CSS;
//   - TypeScript resolves the declarations of every entry under `moduleResolution` bundler and
//     node16, with `skipLibCheck` off, including a styled component with a typed theme.
// `react-native` cannot be loaded by Node, so a stand-in package with the values the binding
// imports takes its place; the real types of `react-native` are covered by the workspace typecheck.
// `react-native-reanimated`, which the animated entry imports, cannot be either (it needs its native
// part), so a stand-in package with the four functions the entry calls takes its place too, at the
// newest version inside the entry's peer range (4.8.0): the entry is loaded, its subpath of the
// umbrella is the same value, and it translates an animation.
// `next`, the optional peer of `@umber-style/react/next`, is a stand-in too, at the newest version inside
// the peer range (16.4.6), packaged as `next` is (no exports map, `navigation.js` at its root) with the one
// hook the entry imports. Node loads that entry and its subpath of the umbrella, `umber-style/react/next`,
// with `require` only: an ES module cannot import `next/navigation` in Node, as the package has no exports
// map; inside Next.js its bundler resolves it.
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
import { findMinifiedExports } from './shared-exports.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const shouldKeep = process.argv.includes('--keep')
// Where each package lives, in the order they are published.
const PACKAGES = [
  { dir: 'core', name: '@umber-style/core' },
  { dir: 'cache', name: '@umber-style/cache' },
  { dir: 'server', name: '@umber-style/server' },
  { dir: 'css', name: '@umber-style/css' },
  { dir: 'is-prop-valid', name: '@umber-style/is-prop-valid' },
  { dir: 'react', name: '@umber-style/react' },
  { dir: 'styled', name: '@umber-style/styled' },
  { dir: 'react-native', name: '@umber-style/react-native' },
  { dir: 'vue', name: '@umber-style/vue' },
  { dir: 'umber-style', name: 'umber-style' },
]
// Every value the main entry of the core exports: what an app uses (the table of docs/plain-javascript.md).
const CORE_EXPORTS = [
  'DEFAULT_SCOPING',
  'NO_THEME_MESSAGE',
  'RULE_LAYERS',
  'STATE_SELECTORS',
  'add',
  'alpha',
  'at',
  'compileRules',
  'createCache',
  'createDomSheet',
  'createEngine',
  'createLazyEngine',
  'createMemorySheet',
  'createStyleTag',
  'createTokens',
  'divide',
  'extractPageStyleParts',
  'extractPageStyles',
  'findEntryCache',
  'findMissingPaths',
  'findMissingStyles',
  'globalStyles',
  'isAlphaColor',
  'isDevelopment',
  'isLiveValue',
  'isSheetEntry',
  'isThemedSheet',
  'keyframes',
  'mergeDeep',
  'mergeStyles',
  'multiply',
  'negate',
  'readLabel',
  'readState',
  'setNonceSource',
  'state',
  'subtract',
]
// Every value of the internal entry of the core: what the bindings and the other packages share.
const CORE_INTERNAL_EXPORTS = [
  'EMPTY_THEME',
  'ROOT_SELECTOR',
  'assertAlphaInput',
  'callCheckedStyle',
  'createComponentSelector',
  'createCssEntry',
  'createDeferredObject',
  'createDeferredRecord',
  'createGlobalMarker',
  'createLazyRecord',
  'createLiveValue',
  'createNoSchemeGuard',
  'createNonceAttribute',
  'createSchemeKey',
  'createScopeRule',
  'createSheetEntry',
  'createStyleSelector',
  'createThemeClass',
  'createThemeClassName',
  'createThemeGuard',
  'createThemeId',
  'createThemeKey',
  'createThemeRule',
  'createThemedSheet',
  'declareLiveValue',
  'findCache',
  'flattenStyle',
  'getBoundaryClass',
  'getSchemeClass',
  'hashString',
  'isTemplateStrings',
  'mergeTheme',
  'parseKeyframesTemplate',
  'parseStyleTemplate',
  'readCondition',
  'readEntrySource',
  'readKeyframesSteps',
  'readNonceSource',
  'readPageNonce',
  'readSharedState',
  'readStaticTemplate',
  'readStyleArguments',
  'readThemedSource',
  'rejectFunctions',
  'rejectThemedEntries',
  'resolveThemeInput',
  'toDeclarationText',
  'toRgba',
  'withTagShorthands',
  'writeLiveValue',
]
// The names every entry of the package must export, and that the ESM and CJS builds must agree on.
const ENTRIES = {
  '@umber-style/core': CORE_EXPORTS,
  '@umber-style/core/internal': CORE_INTERNAL_EXPORTS,
  '@umber-style/cache': ['default', 'createCache'],
  '@umber-style/server/create-instance': ['default', 'createInstance'],
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
  '@umber-style/css/create-instance': ['default', 'createInstance'],
  '@umber-style/is-prop-valid/react': ['default', 'isPropValid'],
  '@umber-style/is-prop-valid/vue': ['default', 'isPropValid'],
  '@umber-style/is-prop-valid/react-native': ['default', 'isPropValid'],
  '@umber-style/react': [
    'createStyle',
    'styled',
    'ThemeProvider',
    'useTheme',
    'StyleSheet',
    'at',
    'state',
    'Global',
    'keyframes',
    'css',
  ],
  '@umber-style/styled': ['default', 'styled'],
  '@umber-style/react-native': [
    'createStyle',
    'state',
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
    'state',
    'styled',
    'ThemeProvider',
    'useTheme',
    'StyleSheet',
    'Global',
    'keyframes',
    'css',
  ],
  'umber-style': ['createEngine', 'createCache', 'extractPageStyles', 'state'],
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
  '@umber-style/react-native/animated': ['animated'],
  'umber-style/react-native/animated': ['animated'],
}
// Each entry with a default export, and the name it also exports that function by: a CommonJS build
// of a library imports it by that name, since its interop takes the whole `module.exports` as the
// default.
const NAMED_DEFAULTS = {
  '@umber-style/styled': 'styled',
  '@umber-style/cache': 'createCache',
  '@umber-style/server/create-instance': 'createInstance',
  '@umber-style/css/create-instance': 'createInstance',
  '@umber-style/is-prop-valid/react': 'isPropValid',
  '@umber-style/is-prop-valid/vue': 'isPropValid',
  '@umber-style/is-prop-valid/react-native': 'isPropValid',
}

const isWindows = process.platform === 'win32'
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
  const needsShell = isWindows && ['npm', 'npx', 'pnpm'].includes(command)
  const result = needsShell
    ? spawnSync([command, ...args.map((arg) => JSON.stringify(arg))].join(' '), {
        encoding: 'utf8',
        shell: true,
        ...options,
      })
    : spawnSync(command, args, { encoding: 'utf8', ...options })
  return { isOk: result.status === 0, out: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}
const readOutput = (result, what) => {
  if (result.isOk) return result.out
  console.error(result.out)
  throw new Error(`${what} failed`)
}

/** Every string in a package.json field (an exports map, a path), with its place. */
const listLeaves = (value, place = []) =>
  typeof value === 'string'
    ? [{ place: place.join('.'), path: value }]
    : Object.entries(value ?? {}).flatMap(([key, child]) => listLeaves(child, [...place, key]))

// 0. Each sibling a package depends on is declared `workspace:^`, which publishes `^<its version>`:
// an exact version (what `workspace:*` publishes) nests a second copy of the sibling under a package
// as soon as the sibling is released alone. devDependencies never reach a consumer and are not read.
const SIBLINGS = new Set(PACKAGES.map(({ name }) => name))
const readManifest = (dir) =>
  JSON.parse(readFileSync(join(repoRoot, 'packages', dir, 'package.json'), 'utf8'))
const listSiblingRanges = (pkg) =>
  ['dependencies', 'peerDependencies'].flatMap((field) =>
    Object.entries(pkg[field] ?? {})
      .filter(([name]) => SIBLINGS.has(name))
      .map(([name, range]) => ({ field, name, range }))
  )
for (const { dir, name } of PACKAGES) {
  for (const { field, name: sibling, range } of listSiblingRanges(readManifest(dir))) {
    check(range === 'workspace:^', `${name}: ${field} ${sibling} is workspace:^ (${range})`)
  }
}

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
    readOutput(
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
    readOutput(
      run('tar', ['-xzf', file, '-C', `../extracted/${dir}`], { cwd: tarballs }),
      `tar ${file}`
    )
    const root = join(into, 'package')
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    // A package with no root entry (`is-prop-valid`) has no main, module or types to point at.
    const hasRoot = '.' in (pkg.exports ?? {})
    const paths = [
      ...listLeaves(pkg.exports),
      ...['main', 'module', 'types']
        .filter((key) => hasRoot || pkg[key] !== undefined)
        .map((key) => ({ place: key, path: pkg[key] })),
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
    for (const { field, name: sibling, range } of listSiblingRanges(pkg)) {
      const expected = `^${readManifest(PACKAGES.find((entry) => entry.name === sibling).dir).version}`
      check(
        range === expected,
        `${name}: ${field} ${sibling} is published as ${expected} (${range})`
      )
    }
    const other = readdirSync(root).filter(
      (entry) => !['dist', 'LICENSE', 'README.md', 'package.json'].includes(entry)
    )
    check(
      other.length === 0,
      `${name}: the tarball holds only dist, LICENSE, README.md, package.json`
    )
    // An ES module no export points at is code the entries share: it keeps its own export names, as
    // a renamed re-export makes Turbopack add a module per imported name (#84).
    const entryFiles = new Set(paths.map(({ path }) => join(root, path)))
    const minified = readdirSync(join(root, 'dist'), { recursive: true })
      .filter((file) => file.endsWith('.mjs'))
      .map((file) => join(root, 'dist', file))
      .filter((file) => !entryFiles.has(file))
      .flatMap((file) => findMinifiedExports(readFileSync(file, 'utf8')))
    const found = minified.length > 0 ? ` (${minified.join(', ')})` : ''
    check(
      minified.length === 0,
      `${name}: no shared chunk exports a name renamed to a minified one${found}`
    )
  }

  // 2. A consumer outside the workspace: the tarballs, resolving each other, and their peers.
  const readVersion = (dir, field, name) =>
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
      'exports.Pressable = function Pressable() { return null }',
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
      'export function Pressable(props: { style?: unknown; children?: unknown }): null',
      '',
    ].join('\n')
  )
  // The stand-in for `next`: its package as it is, with the one hook the entry imports.
  const nextStub = join(consumer, 'next-stub')
  mkdirSync(nextStub)
  writeFileSync(
    join(nextStub, 'package.json'),
    JSON.stringify({ name: 'next', version: '16.4.6', main: 'index.js' })
  )
  writeFileSync(join(nextStub, 'index.js'), '')
  writeFileSync(
    join(nextStub, 'navigation.js'),
    'exports.useServerInsertedHTML = function useServerInsertedHTML() {}\n'
  )
  writeFileSync(
    join(nextStub, 'navigation.d.ts'),
    'export declare function useServerInsertedHTML(callback: () => unknown): void\n'
  )
  // The stand-in for `react-native-reanimated`, which Node cannot load either.
  const reanimated = join(consumer, 'reanimated-stub')
  mkdirSync(reanimated)
  writeFileSync(
    join(reanimated, 'package.json'),
    JSON.stringify({
      name: 'react-native-reanimated',
      version: '4.8.0',
      main: 'index.js',
      types: 'index.d.ts',
    })
  )
  writeFileSync(
    join(reanimated, 'index.js'),
    [
      'exports.createAnimatedComponent = (component) => component',
      'exports.css = { keyframes: (steps) => ({ cssRules: steps, cssText: JSON.stringify(steps), length: Object.keys(steps).length, name: "REA-CSS-0" }) }',
      'exports.cubicBezier = (x1, y1, x2, y2) => ({ x1, y1, x2, y2 })',
      'exports.steps = (stepsNumber, modifier) => ({ stepsNumber, modifier })',
      '',
    ].join('\n')
  )
  writeFileSync(
    join(reanimated, 'index.d.ts'),
    [
      'export function createAnimatedComponent<C>(component: C): C',
      'export const css: { keyframes(steps: object): { cssRules: object; cssText: string; length: number; name: string } }',
      'export function cubicBezier(x1: number, y1: number, x2: number, y2: number): object',
      "export function steps(stepsNumber: number, modifier?: 'jump-start' | 'start' | 'jump-end' | 'end' | 'jump-none' | 'jump-both'): object",
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
          react: readVersion('react', 'devDependencies', 'react'),
          'react-dom': readVersion('react', 'devDependencies', 'react-dom'),
          vue: readVersion('vue', 'devDependencies', 'vue'),
          'react-native': 'file:./react-native-stub',
          'react-native-reanimated': 'file:./reanimated-stub',
          next: 'file:./next-stub',
          '@types/react': readVersion('react', 'devDependencies', '@types/react'),
          '@types/node': readVersion('react', 'devDependencies', '@types/node'),
          typescript: readVersion('react', 'devDependencies', 'typescript'),
        },
        // The tarballs name each other with exact versions that npm does not hold yet: resolve
        // them to the tarballs given above.
        overrides: Object.fromEntries(Object.keys(files).map((name) => [name, `$${name}`])),
      },
      null,
      2
    )
  )
  readOutput(
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
  const createBody = (format) => `
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
// The two entries of the core export exactly their lists, and the root of the umbrella is the main one.
for (const specifier of ['@umber-style/core', '@umber-style/core/internal']) {
  const extra = results[specifier].filter((name) => !entries[specifier].includes(name))
  if (extra.length) throw new Error(specifier + ' also exports ' + extra.join(', '))
}
if (results['umber-style'].join() !== results['@umber-style/core'].join()) throw new Error('umber-style exports other names than @umber-style/core: ' + results['umber-style'].join(', '))
// Each default export is also exported by name: the same function.
for (const [specifier, name] of Object.entries(${JSON.stringify(NAMED_DEFAULTS)})) {
  const mod = mods[specifier]
  if (typeof mod.default !== 'function' || mod[name] !== mod.default) throw new Error(specifier + ': ' + name + ' is not the default export')
}
// One engine: the bindings and the umbrella hand out the very functions of the one core.
const same = (a, b, what) => { if (a !== b) throw new Error('two copies: ' + what) }
same(mods['umber-style'].createEngine, mods['@umber-style/core'].createEngine, 'umber-style and core')
same(mods['@umber-style/react'].at, mods['@umber-style/core'].at, 'react and core')
same(mods['umber-style/react'].styled, mods['@umber-style/react'].styled, 'umber-style/react and react')
same(mods['@umber-style/styled'].default, mods['@umber-style/react'].styled, '@umber-style/styled and react')
same(mods['umber-style/react-native'].styled, mods['@umber-style/react-native'].styled, 'umber-style/react-native')
same(mods['umber-style/vue'].styled, mods['@umber-style/vue'].styled, 'umber-style/vue')
same(mods['umber-style/react-native/animated'].animated, mods['@umber-style/react-native/animated'].animated, 'umber-style/react-native/animated')
// The animated entry over the stand-in of the library: a shorthand with a name of keyframes, translated.
const motion = mods['@umber-style/react-native/animated'].animated.bind({ remBase: 16, readTheme: () => ({}) })
const pulse = mods['@umber-style/react-native'].keyframes({ to: { opacity: 0.4 } }, { label: 'pulse' })
const moving = { animation: pulse + ' 1.5s ease-in-out infinite' }
motion.translate(moving, 'Smoke')
if (moving.animationDuration !== 1500 || moving.animationIterationCount !== 'infinite' || moving.animationName.cssRules['100%'].opacity !== 0.4) throw new Error('the animated entry did not translate: ' + JSON.stringify(moving))
// The prop filters: one function for each platform, and no root entry.
for (const [platform, prop] of [['react', 'tabIndex'], ['vue', 'tabindex'], ['react-native', 'testID']]) {
  const isPropValid = mods['@umber-style/is-prop-valid/' + platform].default
  if (isPropValid(prop) !== true || isPropValid('variant') !== false) throw new Error('is-prop-valid/' + platform + ' answers wrong')
}
const hasRoot = await load('@umber-style/is-prop-valid').then(() => true, () => false)
if (hasRoot) throw new Error('@umber-style/is-prop-valid has a root entry')
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
    `const load = (specifier) => import(specifier)\n${createBody('esm')}`
  )
  writeFileSync(
    join(consumer, 'check.cjs'),
    `const load = async (specifier) => require(specifier)\n;(async () => {${createBody('cjs')}})().catch((error) => { console.error(error); process.exit(1) })\n`
  )
  const esm = run('node', ['check.mjs'], { cwd: consumer })
  check(
    esm.isOk,
    'ESM: every entry loads, each default also by name, one core, a styled component renders'
  )
  if (!esm.isOk) console.error(esm.out)
  const cjs = run('node', ['check.cjs'], { cwd: consumer })
  check(
    cjs.isOk,
    'CJS: every entry loads, each default also by name, one core, a styled component renders'
  )
  if (!cjs.isOk) console.error(cjs.out)
  if (esm.isOk && cjs.isOk) {
    const esmKeys = JSON.parse(readFileSync(join(consumer, 'keys-esm.json'), 'utf8'))
    const cjsKeys = JSON.parse(readFileSync(join(consumer, 'keys-cjs.json'), 'utf8'))
    for (const specifier of Object.keys(ENTRIES)) {
      check(
        JSON.stringify(esmKeys[specifier]) === JSON.stringify(cjsKeys[specifier]),
        `${specifier}: import and require give the same names (${esmKeys[specifier].length})`
      )
    }
    check(
      esmKeys.html === cjsKeys.html,
      'the server render is the same from import and from require'
    )
  }

  // 3a. The entry of the Next.js registry, from CommonJS: the component, which renders its children, and
  // the same component from the subpath of the umbrella.
  writeFileSync(
    join(consumer, 'next.cjs'),
    `
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { StyleRegistry } = require('@umber-style/react/next')
if (typeof StyleRegistry !== 'function') throw new Error('no StyleRegistry')
const html = renderToStaticMarkup(React.createElement(StyleRegistry, null, React.createElement('p', null, 'x')))
if (html !== '<p>x</p>') throw new Error('StyleRegistry rendered ' + html)
const umbrella = require('umber-style/react/next')
if (umbrella.StyleRegistry !== StyleRegistry) throw new Error('umber-style/react/next is another StyleRegistry')
`
  )
  const nextEntry = run('node', ['next.cjs'], { cwd: consumer })
  check(
    nextEntry.isOk,
    '@umber-style/react/next: require gives StyleRegistry, which renders its children; umber-style/react/next gives the same'
  )
  if (!nextEntry.isOk) console.error(nextEntry.out)

  // 3b. The CommonJS build of a library that is `"type": "module"` and imports an entry of ours:
  // its bundler compiles the import as Node's interop does, `__toESM(require(id), 1)`, where the
  // default is the whole `module.exports`, whatever `__esModule` says. Our CommonJS files export
  // `{ __esModule: true, default: fn }`, so such a library gets the object as the default, and gets
  // the function only by name.
  writeFileSync(
    join(consumer, 'interop.cjs'),
    `
const [, , specifier, name] = process.argv
// What the helper of a bundler gives in Node mode: the default is \`module.exports\` itself, and
// every other export is read through by name.
const toEsm = (exported) => {
  const target = { default: exported }
  for (const key of Object.keys(exported)) {
    if (key !== 'default') Object.defineProperty(target, key, { enumerable: true, get: () => exported[key] })
  }
  return target
}
const load = (id) => toEsm(require(id))
const mod = load(specifier)
if (typeof mod.default === 'function') {
  throw new Error(specifier + ': through the Node interop the default is a function: its CommonJS file no longer exports { __esModule, default }. That changes what every existing require() of it gets; if it is meant, say so in the release notes and change this check.')
}
const value = mod[name]
if (typeof value !== 'function') throw new Error(specifier + ': no function named ' + name)
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const calls = {
  '@umber-style/styled': (styled) => /class="[^"]+"/.test(renderToStaticMarkup(React.createElement(styled.div({ padding: 4 }), null, 'x'))),
  '@umber-style/cache': (createCache) => createCache({ key: 'interop' }).key === 'interop',
  '@umber-style/server/create-instance': (createInstance) => {
    const cache = load('@umber-style/cache').createCache({ key: 'interop' })
    return createInstance(cache).renderStylesToString('<p></p>').endsWith('<p></p>')
  },
  '@umber-style/css/create-instance': (createInstance) => createInstance({ key: 'interop' }).css({ color: 'red' }).startsWith('interop-'),
  '@umber-style/is-prop-valid/react': (isPropValid) => isPropValid('tabIndex') && !isPropValid('variant'),
  '@umber-style/is-prop-valid/vue': (isPropValid) => isPropValid('tabindex') && !isPropValid('variant'),
  '@umber-style/is-prop-valid/react-native': (isPropValid) => isPropValid('testID') && !isPropValid('variant'),
}
if (!calls[specifier](value)) throw new Error(specifier + ': ' + name + ' answers wrong')
`
  )
  for (const [specifier, name] of Object.entries(NAMED_DEFAULTS)) {
    const result = run('node', ['interop.cjs', specifier, name], { cwd: consumer })
    check(
      result.isOk,
      `${specifier}: a CommonJS build that loads it through the Node interop gets the function by name (${name}), not as the default`
    )
    if (!result.isOk) console.error(result.out)
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
      check(result.isOk, `${label}, ${what}`)
      if (!result.isOk) console.error(result.out)
    }
  }

  // 5. TypeScript: every entry, bundler and node16 resolution, no skipLibCheck.
  const typed = `
import { createEngine } from '@umber-style/core'
import type { Theme } from '@umber-style/core'
import { callCheckedStyle, createCssEntry, createThemeGuard } from '@umber-style/core/internal'
import type { LiveRule, ThemeGuard } from '@umber-style/core/internal'
// @ts-expect-error the helpers of the bindings are not in the main entry
import { createCssEntry as mainCssEntry } from '@umber-style/core'
// @ts-expect-error nor are their types
import type { LiveRule as MainLiveRule } from '@umber-style/core'
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
import isPropValid from '@umber-style/is-prop-valid/react'
import isVuePropValid from '@umber-style/is-prop-valid/vue'
import isNativePropValid from '@umber-style/is-prop-valid/react-native'
import { createStyle as createShared } from 'umber-style/react'
import { createStyle as createUmbrellaNative } from 'umber-style/react-native'
import { createStyle as createUmbrellaVue } from 'umber-style/vue'
import { animated } from '@umber-style/react-native/animated'
import { animated as umbrellaAnimated } from 'umber-style/react-native/animated'
import type { ComponentProps, CSSProperties } from 'react'

const theme = { palette: { primary: '#1b5fd1', onPrimary: '#ffffff' }, space: [0, 4, 8] }

export const engine = createEngine(theme)
export const guard: ThemeGuard = createThemeGuard('smoke')
export const checked: unknown = callCheckedStyle
export const cssEntry: unknown = [createCssEntry, mainCssEntry]
export const liveRules: [LiveRule?, MainLiveRule?] = []
export const umbrellaEngine = createUmbrellaEngine(theme)
export const umberCache: UmberCache = createCache({ key: 'smoke' })
export const tags: string = createInstance(umberCache).constructStyleTagsFromChunks(
  createInstance(umberCache).extractCriticalToChunks('<p></p>')
)
export const base: Theme | undefined = undefined
export const plainClass: string = cx(css({ padding: 4 }), false, { open: true })
export const ownClass: string = createCssInstance({ key: 'typed' }).css\`color: red;\`
export const propFilters: ((prop: string) => boolean)[] = [isPropValid, isVuePropValid, isNativePropValid]

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
// The default style types: a value widened to string, and React's CSSProperties in the style prop.
const widened = { display: 'grid', alignItems: 'start' }
export const Widened = styled('div')(widened)
const inline: CSSProperties = { marginTop: 4 }
export const inlineStyle: ComponentProps<typeof Card>['style'] = inline

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
export const animatedNative = createNative(theme, { animated }).useTheme().palette.primary
export const animatedUmbrella = createUmbrellaNative(theme, { animated: umbrellaAnimated })
export const sharedWithMotion = createShared(theme, { animated: undefined }).useTheme().palette.primary
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
  const strict = `
import styled from '@umber-style/styled'
import type { ComponentProps, CSSProperties } from 'react'

declare module '@umber-style/react' {
  interface StyleTypeOptions {
    isStrict: true
  }
}

// @ts-expect-error with the strict switch, a misspelt property is an error
export const Typo = styled.div({ backgroudColor: 'red' })
export const Box = styled.div({ display: 'grid' })
const inline: CSSProperties = { marginTop: 4 }
// @ts-expect-error with the strict switch, the style prop takes no CSSProperties
export const inlineStyle: ComponentProps<typeof Box>['style'] = inline
`
  // A CommonJS file of a library: the entries with a default export, imported by name.
  const library = `
import { createCache } from '@umber-style/cache'
import { createInstance as createCssInstance } from '@umber-style/css/create-instance'
import { createInstance } from '@umber-style/server/create-instance'
import { styled } from '@umber-style/styled'

export const cache = createCache({ key: 'lib' })
export const badge: string = createCssInstance({ cache }).css({ margin: 4 })
export const Card = styled.div({ padding: 4 })
export const page: string = createInstance(cache).renderStylesToString('<p></p>')
`
  const ts = join(consumer, 'ts')
  mkdirSync(ts)
  writeFileSync(join(ts, 'entries.ts'), typed)
  writeFileSync(join(ts, 'entries.mts'), typed)
  writeFileSync(join(ts, 'entries.cts'), typed)
  writeFileSync(join(ts, 'server.ts'), server)
  writeFileSync(join(ts, 'strict.ts'), strict)
  writeFileSync(join(ts, 'library.cts'), library)
  writeFileSync(
    join(ts, 'next.ts'),
    `
import { createElement } from 'react'
import createCache from '@umber-style/cache'
import { StyleRegistry } from '@umber-style/react/next'
import type { StyleRegistryProps } from '@umber-style/react/next'
import { StyleRegistry as UmbrellaRegistry } from 'umber-style/react/next'
import type { StyleRegistryProps as UmbrellaProps } from 'umber-style/react/next'

const props: StyleRegistryProps = { cache: createCache({ key: 'smoke' }), children: 'x' }
export const registry = createElement(StyleRegistry, props)
const umbrellaProps: UmbrellaProps = props
export const umbrellaRegistry = createElement(UmbrellaRegistry, umbrellaProps)
`
  )
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
      ['ts/entries.ts', 'ts/next.ts'],
      'moduleResolution bundler, the Next.js registry included',
    ],
    [
      'tsconfig.node16.json',
      { ...options, module: 'node16', moduleResolution: 'node16' },
      ['ts/entries.mts', 'ts/entries.cts', 'ts/library.cts'],
      'moduleResolution node16, from an ES module and from a CommonJS file, and the default exports by name',
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
    [
      'tsconfig.strict.json',
      { ...options, module: 'esnext', moduleResolution: 'bundler' },
      ['ts/strict.ts'],
      'the strict switch, through the StyleTypeOptions of @umber-style/react',
    ],
  ]) {
    writeFileSync(join(consumer, file), JSON.stringify({ compilerOptions, include }, null, 2))
    const result = run('npx', ['--no-install', 'tsc', '-p', file], { cwd: consumer })
    check(result.isOk, `types: ${what}`)
    if (!result.isOk) console.error(result.out)
  }
} finally {
  if (shouldKeep) console.log(`kept ${work}`)
  else rmSync(work, { recursive: true, force: true })
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed.`)
  process.exit(1)
}
console.log('\nThe packed packages work from outside the workspace.')
