import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { createCache, createMemorySheet } from '@umber-style/core'
import { createStyle } from './createStyle'

const base = { palette: { primary: '#0000ff', text: '#111111' }, space: [0, 4] }
const dark = { palette: { primary: '#8888ff', text: '#eeeeee' } }

/** A style whose base theme is `base`, as `configure({ theme: base })` gives it. */
function setup() {
  return createStyle(base, {
    prefix: 'mt',
    cache: createCache({ prefix: 'mt', sheet: createMemorySheet(), hasDevChecks: false }),
  })
}

describe('the theme of a provider given another object than the base theme', () => {
  it('is the same object in every render, for a stable theme and for a new object of the same contents', () => {
    const { ThemeProvider, useTheme } = setup()
    const seen: object[] = []
    function Probe() {
      seen.push(useTheme())
      return null
    }
    const container = document.createElement('div')
    const root = createRoot(container)
    const render = (theme: object) =>
      act(() =>
        root.render(
          <ThemeProvider theme={theme}>
            <Probe />
          </ThemeProvider>
        )
      )
    render(dark)
    render(dark)
    render({ ...dark })
    render(structuredClone(dark))
    act(() => root.unmount())
    expect(new Set(seen).size).toBe(1)
    expect(seen[0]).toEqual({ palette: dark.palette, space: [0, 4] })
  })

  it('is the same object in each server render, so the work of the render before is found again', () => {
    const { ThemeProvider, useTheme } = setup()
    const seen: object[] = []
    function Probe() {
      seen.push(useTheme())
      return null
    }
    const page = (theme: object) => (
      <ThemeProvider theme={theme}>
        <Probe />
      </ThemeProvider>
    )
    const html = renderToString(page(dark))
    expect(renderToString(page({ ...dark }))).toBe(html)
    expect(seen[1]).toBe(seen[0])
  })
})
