import { render } from '@testing-library/react'
import { createEngine, createLazyEngine } from '@umber-style/core'
import { EMPTY_THEME } from '@umber-style/core/internal'
import { createThemeContexts, createThemeValue } from './ThemeValue'

const base = { a: { b: 1, c: 2 } }

describe('createThemeValue with no provider above', () => {
  it('gives the base theme and its view, no wrapper class, and the children alone in ThemeScope', () => {
    const engine = createEngine(base)
    const { useTheme, useThemeView, useThemeClass, ThemeScope } = createThemeValue(
      engine,
      createThemeContexts()
    )
    const seen: unknown[] = []
    const Probe = () => {
      seen.push(useTheme(), useThemeView(), useThemeClass())
      return <i />
    }
    const { container } = render(
      <ThemeScope>
        <Probe />
      </ThemeScope>
    )
    expect(seen).toEqual([base, engine.refs, undefined])
    expect(container.innerHTML).toBe('<i></i>')
  })

  it('gives an empty theme, and its view, when there is no base theme either', () => {
    const engine = createLazyEngine<typeof base>()
    const { useTheme, useThemeView } = createThemeValue(engine, createThemeContexts())
    const seen: unknown[] = []
    const Probe = () => {
      seen.push(useTheme(), useThemeView())
      return null
    }
    render(<Probe />)
    expect(seen[0]).toBe(EMPTY_THEME)
    expect(seen[1]).toEqual({})
  })
})
