import { render, screen } from '@testing-library/react'
import { at, createCache, createEngine, createMemorySheet } from '@umber-style/core'
import { bindEngine } from './createStyle'

const base = { palette: { primary: '#0000ff', surface: '#ffffff' } }
const dark = { palette: { primary: '#8888ff', surface: '#111111' } }
const other = { palette: { primary: '#00ff00', surface: '#eeeeee' } }

function setup(options: { hasScope?: boolean } = {}) {
  const sheet = createMemorySheet()
  const engine = createEngine(base, {
    prefix: 'k',
    cache: createCache({ prefix: 'k', sheet, ...options }),
  })
  return { ...bindEngine(engine), sheet }
}

describe('theme conditions in the client build', () => {
  it('puts the boundary on each theme element of A > B > A, and scopes the card to A', () => {
    const { styled, ThemeProvider, when, whenScheme, engine, sheet } = setup()
    const Card = styled('div')({
      border: 'none',
      ...at(when(dark, 'dark'), { border: '1px solid white', '&:hover': { borderColor: 'red' } }),
      ...at(whenScheme('dark'), { boxShadow: 'none' }),
    })
    render(
      <ThemeProvider theme={dark} colorScheme="dark">
        <Card>a</Card>
        <ThemeProvider theme={other} colorScheme="light">
          <Card>b</Card>
          <ThemeProvider theme={dark} colorScheme="dark">
            <Card>c</Card>
          </ThemeProvider>
        </ThemeProvider>
      </ThemeProvider>
    )
    const wrappers = [screen.getByText('a'), screen.getByText('b'), screen.getByText('c')].map(
      (card) => (card.parentElement as HTMLElement).className
    )
    const darkClasses = engine.themeClass(dark, 'dark')
    expect(wrappers[0]).toBe(`${darkClasses} k-scope`)
    expect(wrappers[1]).toBe(`${engine.themeClass(other, 'light')} k-scope`)
    expect(wrappers[2]).toBe(wrappers[0])
    for (const classes of wrappers) expect(classes.split(' ')).toContain('k-boundary')
    const card = screen.getByText('a').className
    const id = engine.themeId(dark, 'dark')
    expect(sheet.rules.filter((rule) => rule.includes('@scope'))).toEqual([
      `@layer k-components{@scope (.${id}) to (.k-boundary){.${card}{border:1px solid white;}.${card}:hover{border-color:red;}}}`,
      `@layer k-components{@scope (.k-scheme-dark) to (.k-scheme-light,.k-scheme-dark){.${card}{box-shadow:none;}}}`,
    ])
  })

  it('writes the descendant form with hasScope false', () => {
    const { styled, when, engine, sheet } = setup({ hasScope: false })
    const Card = styled('div')({ ...at(when(dark), { border: '1px solid white' }) })
    render(<Card>a</Card>)
    const card = screen.getByText('a').className
    expect(sheet.rules).toContain(
      `@layer k-components{:where(.${engine.themeId(dark)}) .${card}{border:1px solid white;}}`
    )
  })
})
