// @vitest-environment node
import { renderToString } from 'react-dom/server'
import { createCache, createLazyEngine, globalStyles } from '@umber-style/core'
import { bindEngine } from './createStyle'

const theme = {
  palette: { primary: '#0000ff', text: '#111111' },
  space: [0, 4, 8],
  breakpoints: { md: 900 },
}
type PageTheme = typeof theme

/** A style as `configure` makes it (no base theme), a component of the theme and its props, and a page. */
function setup(prefix: string) {
  const engine = createLazyEngine<PageTheme>({
    prefix,
    hasValueRepair: true,
    cache: createCache({ prefix, hasDevChecks: false }),
  })
  const style = bindEngine(engine)
  const reset = vi.fn((view: PageTheme) => ({ body: { color: view.palette.text } }))
  const styles = globalStyles(reset)
  const Box = style.styled('div', { name: 'Box' })<{ size: number }>(
    ({ theme: view }) => ({ color: view.palette.primary, padding: view.space[1] }),
    ({ size }) => ({ minHeight: size * 8 })
  )
  const Page = ({ given }: { given: PageTheme }) => (
    <style.ThemeProvider theme={given}>
      <style.Global styles={styles} />
      <Box size={1} />
      <Box size={2} />
    </style.ThemeProvider>
  )
  return { Page, reset }
}

describe('a server render whose provider is given a theme of the same contents in a new object', () => {
  const { Page: Reference } = setup('st')
  const reference = [theme, theme].map((given) => renderToString(<Reference given={given} />))

  it.each([
    ['a shallow copy', () => ({ ...theme })],
    ['a deep copy', () => structuredClone(theme)],
  ])('renders what the same object renders, given %s in each render', (_label, copy) => {
    const { Page } = setup('st')
    expect([0, 1].map(() => renderToString(<Page given={copy()} />))).toEqual(reference)
  })

  it('renders the new value of a copy with one value changed', () => {
    const { Page } = setup('st')
    renderToString(<Page given={theme} />)
    const html = renderToString(
      <Page given={{ ...theme, palette: { ...theme.palette, text: '#ff0000' } }} />
    )
    expect(html).toContain('--st-palette-text:#ff0000;')
    expect(html).not.toBe(reference[1])
  })

  it('reads the styles of Global again only for another view', () => {
    const { Page, reset } = setup('sg')
    renderToString(<Page given={{ ...theme }} />)
    renderToString(<Page given={{ ...theme }} />)
    // Once for the id of the handle, with a stand-in theme, and once for the view.
    expect(reset).toHaveBeenCalledTimes(2)
    renderToString(<Page given={{ ...theme, breakpoints: { md: 1024 } }} />)
    expect(reset).toHaveBeenCalledTimes(3)
  })

  it('resolves styles that are nothing each time, as before', () => {
    const engine = createLazyEngine<PageTheme>({
      prefix: 'sn',
      cache: createCache({ prefix: 'sn' }),
    })
    const style = bindEngine(engine)
    const page = (
      <style.ThemeProvider theme={theme}>
        <style.Global styles={false} />
        <style.Global styles={null} />
      </style.ThemeProvider>
    )
    expect(renderToString(page)).toBe(renderToString(page))
  })
})
