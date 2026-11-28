// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as root from './index'
import * as react from './react'
import * as reactNative from './react-native'
import * as reactServer from './react.server'
import * as vue from './vue'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  exports: Record<string, Target>
}

type Target = string | { [condition: string]: Target }

/** The files that an exports target points at, through any nesting of conditions. */
function collectTargets(target: Target): string[] {
  return typeof target === 'string' ? [target] : Object.values(target).flatMap(collectTargets)
}

describe('the entries of umber-style', () => {
  it('the root is the engine', () => {
    for (const name of [
      'createEngine',
      'createLazyEngine',
      'createCache',
      'mergeDeep',
      'alpha',
      'isSheetEntry',
    ]) {
      expect(root).toHaveProperty(name)
    }
    expect(root).not.toHaveProperty('createStyle')
  })

  it('the react-server entry exposes createStyle too (it re-exports the package, which picks its own build)', () => {
    expect(reactServer).toHaveProperty('createStyle')
    expect(reactServer).toHaveProperty('Global')
  })

  it('each binding exposes createStyle and the default style', () => {
    const names = [
      'createStyle',
      'styled',
      'ThemeProvider',
      'useTheme',
      'StyleSheet',
      'useStyle',
      'apply',
      'css',
      'themeClass',
      'configure',
      'keyframes',
      'globalStyles',
      'Global',
    ]
    for (const binding of [react, reactNative, vue]) {
      for (const name of names) expect(binding).toHaveProperty(name)
    }
    for (const binding of [react, reactNative, reactServer]) {
      for (const name of ['withTheme', 'withStyle']) expect(binding).toHaveProperty(name)
    }
    for (const binding of [react, vue]) expect(binding).toHaveProperty('getEngine')
    for (const binding of [react, reactNative, vue]) {
      for (const name of ['ThemeScope', 'useThemeClass']) expect(binding).toHaveProperty(name)
    }
    for (const binding of [react, reactNative]) expect(binding).toHaveProperty('ThemeContext')
    for (const binding of [react, reactNative, vue]) expect(binding).toHaveProperty('CacheProvider')
    for (const binding of [react, reactNative, vue]) {
      for (const name of ['alpha', 'at', 'multiply', 'divide', 'add', 'subtract', 'negate']) {
        expect(binding).toHaveProperty(name)
      }
    }
    expect(String(react.alpha('red', 0.5))).toBe('color-mix(in srgb, red 50%, transparent)')
    expect(react.alpha('red', 1)).toBe('red')
    expect(reactNative.alpha('#fff', 1)).toBe('#fff')
    expect(reactNative.alpha('#fff', 0.5)).toBe('rgba(255, 255, 255, 0.5)')
  })

  it('the exports map points at files that exist, with the platform switch on /react', () => {
    const targets = Object.values(manifest.exports).flatMap(collectTargets)
    expect(targets).toHaveLength(10)
    for (const target of targets) {
      expect(existsSync(fileURLToPath(new URL(`../${target}`, import.meta.url)))).toBe(true)
    }
    // The `react-server` condition is first, with its own types: under the custom condition the compiler
    // reads `shared.server.ts` (`useTheme` and `readTheme`), else the `types` condition reads the shared types, and a
    // bundler skips `types`.
    expect(manifest.exports['./react']).toEqual({
      'react-server': { types: './src/shared.server.ts', default: './src/react.server.ts' },
      types: './src/shared.ts',
      'react-native': './src/react-native.ts',
      default: './src/react.ts',
    })
  })
})
