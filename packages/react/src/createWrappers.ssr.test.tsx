// @vitest-environment node
import { Component } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SheetEntry } from '@umber-style/core'
import { createStyle } from './createStyle'

const theme = { palette: { primary: '#0000ff', surface: '#ffffff' } }

type AppTheme = typeof theme

describe('withTheme and withStyle in the server render of a client component', () => {
  it('give a class component the nearest theme and the entries that the hooks give there', () => {
    const { StyleSheet, ThemeProvider, apply, useStyle, useTheme, withStyle, withTheme } =
      createStyle(theme, { prefix: 'wx', hasServerStyleElements: false })
    const sheet = StyleSheet.create((current) => ({ card: { color: current.palette.primary } }))
    class Card extends Component<{ theme: AppTheme; styles: { card: SheetEntry } }> {
      render() {
        const { theme: given, styles } = this.props
        return <p {...apply(styles.card)}>{given.palette.surface}</p>
      }
    }
    const Probe = () => {
      const { palette } = useTheme()
      return <i {...apply(useStyle(sheet).card)}>{palette.surface}</i>
    }
    const Wrapped = withTheme(withStyle(sheet)(Card))
    const html = renderToStaticMarkup(
      <ThemeProvider theme={theme}>
        <ThemeProvider theme={{ palette: { surface: '#fff4d6' } }}>
          <Wrapped />
          <Probe />
        </ThemeProvider>
      </ThemeProvider>
    )
    const [, className, text] = /<p class="([^"]+)">([^<]+)<\/p>/.exec(html) as RegExpExecArray
    expect(text).toBe('#fff4d6')
    expect(html).toContain(`<i class="${className}">#fff4d6</i>`)
  })
})
