import { createEngine } from '@umber-style/core'
import { bindEngine } from './createStyle.server'
import type { CacheFunction } from './serverContext'
import { findAll, resolveTree } from './vitest.resolveTree'
import { createThemeProbe, nestedTheme, probeTheme } from './vitest.themeProbe'

const requestCache: CacheFunction = (make) => {
  let value: ReturnType<typeof make> | undefined
  return () => (value ??= make())
}

describe('one component source that calls useTheme(), as a server component', () => {
  it('reads the base theme, under the outermost provider and under a nested one', async () => {
    const style = bindEngine(createEngine(probeTheme, { prefix: 'ut' }), requestCache)
    const ThemeProbe = createThemeProbe(style)
    const tree = await resolveTree(
      <style.ThemeProvider theme={{ ...probeTheme, breakpoints: ['900px'] }}>
        <ThemeProbe id="outer" />
        <style.ThemeProvider theme={nestedTheme}>
          <ThemeProbe id="nested" />
        </style.ThemeProvider>
      </style.ThemeProvider>
    )
    expect(findAll(tree, 'code').map((code) => code.children.join(''))).toEqual([
      '#ffffff 600px',
      '#ffffff 600px',
    ])
  })
})
