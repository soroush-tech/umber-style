// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as root from './index'
import * as react from './react'
import * as reactNative from './react-native'
import * as reactServer from './react.server'
import * as vue from './vue'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  exports: Record<string, string | Record<string, string>>
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
      'themeClass',
      'configure',
    ]
    for (const binding of [react, reactNative, vue]) {
      for (const name of names) expect(binding).toHaveProperty(name)
    }
    for (const binding of [react, vue]) expect(binding).toHaveProperty('getEngine')
    for (const binding of [react, reactNative]) {
      for (const name of ['multiply', 'divide', 'add', 'subtract', 'negate']) {
        expect(binding).toHaveProperty(name)
      }
    }
    expect(react.alpha('red', 1)).toBe('color-mix(in srgb, red 100%, transparent)')
    expect(reactNative.alpha('#fff', 1)).toBe('rgba(255, 255, 255, 1)')
  })

  it('the exports map points at files that exist, with the platform switch on /react', () => {
    const targets = Object.values(manifest.exports).flatMap((target) =>
      typeof target === 'string' ? [target] : Object.values(target)
    )
    expect(targets).toHaveLength(7)
    for (const target of targets) {
      expect(existsSync(fileURLToPath(new URL(`../${target}`, import.meta.url)))).toBe(true)
    }
    // The `types` condition is first: the compiler reads the shared types, a bundler skips it.
    expect(manifest.exports['./react']).toEqual({
      types: './src/shared.ts',
      'react-native': './src/react-native.ts',
      'react-server': './src/react.server.ts',
      default: './src/react.ts',
    })
  })
})
