import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render } from '@testing-library/react'
import { createElement } from 'react'
import * as entry from './index'

const SOURCE = dirname(fileURLToPath(import.meta.url))
const IMPORT_PATTERN = /(?:from|import)\s+'([^']+)'/g

/** The file a relative import points to. */
function resolveImport(from: string, specifier: string): string {
  const base = join(dirname(from), specifier)
  return [`${base}.ts`, `${base}.tsx`].find((candidate) => existsSync(candidate)) as string
}

describe('the entry of @umber-style/react-native', () => {
  it('exports the default style, createStyle and alpha', () => {
    for (const name of [
      'styled',
      'ThemeProvider',
      'ThemeScope',
      'useThemeClass',
      'useMediaQuery',
      'ThemeContext',
      'useTheme',
      'StyleSheet',
      'useStyle',
      'withTheme',
      'withStyle',
      'apply',
      'css',
      'themeClass',
      'when',
      'whenScheme',
      'keyframes',
      'globalStyles',
      'Global',
      'configure',
      'createStyle',
      'alpha',
      'multiply',
      'divide',
      'add',
      'subtract',
      'negate',
      'at',
    ]) {
      expect(entry).toHaveProperty(name)
    }
    expect(entry.alpha('#fff', 1)).toBe('#fff')
    expect(entry.alpha('#fff', 0.5)).toBe('rgba(255, 255, 255, 0.5)')
    expect(entry.multiply(8, 2)).toBe(16)
  })

  it('configures the default style once, before it is used, and makes keyframes and global styles before it', () => {
    const fade = entry.keyframes({ from: { opacity: 0 } }, { label: 'fade' })
    expect(fade).toMatch(/^fade-[a-z0-9]+$/)
    expect(entry.globalStyles({ body: { margin: 0 } }).id).toMatch(/^global-/)
    entry.configure({ theme: { palette: { primary: 'red' }, space: [0, 4] } })
    expect(entry.themeClass({}, 'dark')).toBe('')
    expect(() => entry.configure({})).toThrow()
  })

  it('never loads the animated entry or the animation library: an app without the entry pays nothing for it', () => {
    const files = new Set<string>()
    const specifiers: string[] = []
    const queue = [join(SOURCE, 'index.ts')]
    while (queue.length > 0) {
      const file = queue.pop() as string
      if (files.has(file)) continue
      files.add(file)
      for (const [, specifier] of readFileSync(file, 'utf8').matchAll(IMPORT_PATTERN)) {
        specifiers.push(specifier)
        if (specifier.startsWith('.')) queue.push(resolveImport(file, specifier))
      }
    }
    const names = [...files].map((file) => basename(file))
    expect(names).toContain('styled.ts')
    expect(
      names.filter((name) => name.startsWith('animated') || name.startsWith('motion'))
    ).toEqual([])
    expect(specifiers.filter((specifier) => specifier.startsWith('react-native-'))).toEqual([])
  })

  it('has a Global that renders nothing', () => {
    const { container } = render(createElement(entry.Global, { styles: { body: { margin: 0 } } }))
    expect(container.innerHTML).toBe('')
  })
})
