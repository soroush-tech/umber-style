import { render } from '@testing-library/react'
import { system } from '@soroush.tech/styled-system/core'
import { space } from '@soroush.tech/styled-system/space'
import shouldForwardProp from '@soroush.tech/styled-system/should-forward-prop'
import { variant } from '@soroush.tech/styled-system/variant'
import { createCache, createMemorySheet } from '@umber-style/core'
import { createStyle } from './createStyle'

const baseTheme = {
  palette: { primary: '#0000ff', onPrimary: '#ffffff' },
  colors: { brand: '#ff0000' },
  space: [0, 4, 8, 16],
  buttons: { primary: { color: '#ffffff', padding: 8 } },
  breakpoints: ['600px', '900px'] as string[] | Record<string, number>,
}

function setup(theme = baseTheme) {
  const sheet = createMemorySheet()
  const style = createStyle(theme, { prefix: 'p', cache: createCache({ prefix: 'p', sheet }) })
  const cssOf = () => sheet.rules.join('')
  return { ...style, sheet, cssOf }
}

describe('styled-system parsers as style functions', () => {
  it('space: p={2} reads the scale through the variable references', () => {
    const { styled, cssOf } = setup()
    const Box = styled('div')(space)
    render(<Box p={2} />)
    expect(cssOf()).toContain('padding:var(--p-space-2);')
  })

  it('space: a responsive array uses the real breakpoints, which are a raw key', () => {
    const { styled, sheet } = setup()
    const Box = styled('div')(space)
    const className = (render(<Box p={[1, 2, 3]} />).container.lastElementChild as Element)
      .className
    expect(sheet.rules).toEqual([
      `.${className}{padding:var(--p-space-1);}`,
      `@media (width >= 600px){.${className}{padding:var(--p-space-2);}}`,
      `@media (width >= 900px){.${className}{padding:var(--p-space-3);}}`,
    ])
  })

  it('space: a responsive object uses named breakpoints', () => {
    const { styled, cssOf } = setup({ ...baseTheme, breakpoints: { tablet: 700 } })
    const Box = styled('div')(space)
    render(<Box p={{ _: 1, tablet: 2 }} />)
    expect(cssOf()).toContain('padding:var(--p-space-1);')
    expect(cssOf()).toContain('@media (width >= 700px)')
    expect(cssOf()).toContain('padding:var(--p-space-2);')
  })

  it('color: a parser made with system() reads the palette', () => {
    const { styled, cssOf } = setup()
    const color = system({ color: { property: 'color', scale: 'palette' } })
    const Box = styled('div')(color)
    render(<Box color="primary" />)
    expect(cssOf()).toContain('color:var(--p-palette-primary);')
  })

  it('variant: selects styles by prop; the styles may name theme values or use references', () => {
    const { styled, engine, cssOf } = setup()
    const { palette } = engine.refs
    const kind = variant({
      prop: 'kind',
      variants: {
        filled: { background: palette.primary, color: palette.onPrimary },
        outlined: { color: 'brand', border: `1px solid ${palette.primary}` },
      },
    })
    const Button = styled('button')(kind)
    const { container } = render(
      <>
        <Button kind="filled" />
        <Button kind="outlined" />
        <Button kind="other" />
      </>
    )
    const [filled, outlined, other] = [...container.children]
    expect(new Set([filled.className, outlined.className]).size).toBe(2)
    // An unknown variant gives a style with no declaration, and so no class.
    expect(other.hasAttribute('class')).toBe(false)
    expect(cssOf()).toContain(
      'background:var(--p-palette-primary);color:var(--p-palette-on-primary);'
    )
    // `brand` was looked up in theme.colors, which is a scale of the theme like any other.
    expect(cssOf()).toContain(
      'color:var(--p-colors-brand);border:1px solid var(--p-palette-primary);'
    )
  })

  it('variant: reads the variants from a scale of the theme', () => {
    const { styled, themeClass, cssOf } = setup()
    const Button = styled('button')(variant({ scale: 'buttons', prop: 'kind' }))
    render(<Button kind="primary" />)
    themeClass(baseTheme)
    expect(cssOf()).toContain(
      'color:var(--p-buttons-primary-color);padding:var(--p-buttons-primary-padding);'
    )
    // KNOWN GAP: the number 8 is not under a length key, so its variable is declared without px.
    expect(cssOf()).toContain('--p-buttons-primary-padding:8;')
  })

  it('space: a negative margin is not valid CSS today', () => {
    const { styled, cssOf } = setup()
    const Box = styled('div')(space)
    render(<Box m={-2} />)
    // KNOWN GAP: styled-system turns a negative key into '-' + the scale value, and the value
    // is a var() text here. The valid rule would be calc(var(--p-space-2) * -1).
    expect(cssOf()).toContain('margin:-var(--p-space-2);')
  })

  it('space: a margin with a scale value that is not negative is fine', () => {
    const { styled, cssOf } = setup()
    const Box = styled('div')(space)
    render(<Box mx={3} />)
    expect(cssOf()).toContain('margin-left:var(--p-space-3);margin-right:var(--p-space-3);')
  })

  it('shouldForwardProp of styled-system keeps system props off the element', () => {
    const { styled, cssOf } = setup()
    const Box = styled('div', { shouldForwardProp })(space)
    const { container } = render(<Box p={2} m={1} id="a" data-x="1" />)
    const element = container.firstElementChild as HTMLElement
    expect(element.getAttributeNames().sort()).toEqual(['class', 'data-x', 'id'])
    expect(cssOf()).toContain('padding:var(--p-space-2);')
  })
})
