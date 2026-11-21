import { render } from '@testing-library/react'
import { createElement } from 'react'
import { expectTypeOf } from 'vitest'
import { createDefaultStyle } from './defaultStyle'
import { createStyle } from './createStyle'
import type { NativeStyleObject } from './nativeStyle'

const theme = { palette: { primary: '#0000ff' } }

describe('css on React Native', () => {
  it('merges native styles in order, the last key winning, and drops what is falsy', () => {
    const { css } = createStyle(theme)
    const card = css({ padding: 8, opacity: 1 }, [false, null, undefined, [{ opacity: 0.5 }]])
    expect(card).toEqual({ padding: 8, opacity: 0.5 })
    expectTypeOf(card).toEqualTypeOf<NativeStyleObject>()
  })

  it('turns each style into a native one: lengths are numbers, web-only keys are dropped', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { css } = createStyle(theme, { remBase: 10 })
    const style = { margin: '8px', width: '2rem', '&:hover': { opacity: 0 }, label: 'card' }
    expect(css(style as NativeStyleObject)).toEqual({ margin: 8, width: 20 })
    expect(warn.mock.calls.map(([message]) => message)).toContainEqual(
      expect.stringContaining('css()')
    )
    warn.mockRestore()
  })

  it('reads a tagged template as CSS text: kebab names in camelCase, lengths in px as numbers', () => {
    const { css } = createStyle(theme)
    expect(css`
      background-color: ${theme.palette.primary};
      padding-top: 8px;
    `).toEqual({ backgroundColor: '#0000ff', paddingTop: 8 })
  })

  it('throws a TypeError for a function, alone or in a template, and for what is not a style', () => {
    const { css } = createStyle(theme)
    expect(() => css((() => ({})) as never)).toThrow(TypeError)
    expect(
      () => css`
        color: ${(() => 'red') as never};
      `
    ).toThrow(TypeError)
    expect(() => css('padding: 8px' as never)).toThrow(
      new TypeError('css(): "padding: 8px" is not a style: give style objects.')
    )
  })

  it('gives a value that goes in the style of a styled component', () => {
    const { css, styled } = createStyle(theme)
    const calls: Record<string, unknown>[] = []
    const View = (props: Record<string, unknown>) => {
      calls.push(props)
      return createElement('view')
    }
    const card = css({ padding: 8 })
    const Box = styled(View)({ margin: 1 })
    render(<Box style={card} />)
    expect(calls[0].style).toEqual([{ margin: 1 }, { padding: 8 }])
  })

  it('is made on first use in the default style, so a module can call it before configure', () => {
    const style = createDefaultStyle()
    const card = style.css({ width: '1rem' })
    style.configure({ remBase: 10 })
    expect({ ...card }).toEqual({ width: 10 })
  })
})
