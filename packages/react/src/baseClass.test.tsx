import { render, screen } from '@testing-library/react'
import {
  createCache,
  createLazyEngine,
  type Theme,
  createEngine,
  createMemorySheet,
  createStyleTag,
} from '@umber-style/core'
import { bindEngine, createStyle } from './createStyle'
import { createDefaultStyle } from './defaultStyle'

const baseTheme = { palette: { primary: '#0000ff' }, space: [0, 4, 8] }
type AppTheme = typeof baseTheme

afterEach(() => {
  document.head.innerHTML = ''
})

function setup(options: { hasBaseClass?: boolean; hasLabels?: boolean } = {}) {
  const sheet = createMemorySheet()
  const style = createStyle(baseTheme, {
    prefix: 'b',
    cache: createCache({ hasPruning: false, prefix: 'b', sheet, ...options }),
  })
  const rules = () => sheet.rules.filter((rule) => !rule.startsWith('@layer b-theme,'))
  return { ...style, sheet, rules }
}

type FlexProps = { gap?: number; $on?: boolean }

describe('a styled component with a base class and a props class', () => {
  it('renders base, props: the fixed styles once, the rest for each distinct result', () => {
    const { styled, rules } = setup()
    const Flex = styled('div', { name: 'Flex' })<FlexProps>(
      { display: 'flex', minWidth: 0 },
      ({ gap }) => ({ gap })
    )
    render(<Flex data-testid="a" gap={4} />)
    render(<Flex data-testid="b" gap={8} />)
    const a = screen.getByTestId('a').className.split(' ')
    const b = screen.getByTestId('b').className.split(' ')
    expect(a).toHaveLength(2)
    expect(a[0]).toBe(b[0])
    expect(a[1]).not.toBe(b[1])
    expect(rules()).toEqual([
      `@layer b-components{.${a[0]}{display:flex;min-width:0;}}`,
      `@layer b-components{.${a[1]}{gap:4px;}}`,
      `@layer b-components{.${b[1]}{gap:8px;}}`,
    ])
  })

  it('has the old output, one class for the whole list, without hasBaseClass', () => {
    const { styled, rules } = setup({ hasBaseClass: false })
    const Flex = styled('div', { name: 'Flex' })<FlexProps>(
      { display: 'flex', minWidth: 0 },
      ({ gap }) => ({ gap })
    )
    render(<Flex data-testid="a" gap={4} />)
    const a = screen.getByTestId('a').className
    expect(a.split(' ')).toHaveLength(1)
    expect(rules()).toEqual([`@layer b-components{.${a}{display:flex;min-width:0;gap:4px;}}`])
  })

  it('keeps foreign classes before the override class, which is last', () => {
    const { styled } = setup()
    const Flex = styled('div', { name: 'Flex' })<FlexProps>({ display: 'flex' }, ({ gap }) => ({
      gap,
    }))
    render(<Flex data-testid="a" gap={4} className="mine" style={{ margin: 1 }} />)
    const [base, props, foreign, override] = screen.getByTestId('a').className.split(' ')
    expect(foreign).toBe('mine')
    expect([base, props, override].every((name) => name.startsWith('b-flex-root-'))).toBe(true)
  })

  it('puts a function that reads only the theme into the base, and shares it between two providers that differ in token values', () => {
    const { styled, ThemeProvider, rules } = setup()
    const Card = styled('div', { name: 'Card' })<FlexProps>(
      { display: 'block' },
      ({ theme }: { theme: AppTheme }) => ({ color: theme.palette.primary }),
      ({ gap }) => ({ gap })
    )
    const dark = { palette: { primary: '#111111' } }
    render(
      <>
        <ThemeProvider theme={baseTheme}>
          <Card data-testid="a" gap={1} />
        </ThemeProvider>
        <ThemeProvider theme={dark}>
          <Card data-testid="b" gap={1} />
        </ThemeProvider>
      </>
    )
    const a = screen.getByTestId('a').className.split(' ')
    const b = screen.getByTestId('b').className.split(' ')
    expect(a).toEqual(b)
    expect(rules().filter((rule) => rule.includes('color:var(--b-palette-primary)'))).toHaveLength(
      1
    )
  })

  it('ends the base at a parser that reads props, such as space', async () => {
    const { space } = await import('@soroush.tech/styled-system/space')
    const { styled } = setup()
    const Box = styled('div', { name: 'Box' })({ display: 'block' }, space)
    render(<Box data-testid="a" p={1} />)
    const names = screen.getByTestId('a').className.split(' ')
    expect(names).toHaveLength(2)
  })
})

describe('a styled component that wraps one with a base class', () => {
  it('flattens to one element that carries the base of the inner one under its own label', () => {
    const { styled, rules } = setup()
    const Inner = styled('div', { name: 'Inner' })<FlexProps>({ display: 'flex' }, ({ gap }) => ({
      gap,
    }))
    const Outer = styled(Inner, { name: 'Outer' })({ margin: 1 })
    render(<Inner data-testid="i" gap={2} />)
    render(<Outer data-testid="o" gap={2} />)
    const inner = screen.getByTestId('i').className.split(' ')
    const outer = screen.getByTestId('o').className.split(' ')
    expect(outer[0]).toBe(inner[0].replace('inner', 'outer'))
    expect(outer[1]).toMatch(/^b-outer-root-/)
    expect(rules().filter((rule) => rule.includes('display:flex'))).toHaveLength(2)
  })
})

describe('a sheet entry given alone through style', () => {
  it('is the class of the element as it is: two components, one rule in the overrides layer', () => {
    const { styled, StyleSheet, rules } = setup()
    const sheet = StyleSheet.create({ danger: { color: 'red' } })
    const One = styled('div', { name: 'One' })({ margin: 1 })
    const Two = styled('p', { name: 'Two' })({ margin: 2 })
    render(<One data-testid="one" style={sheet.danger} />)
    render(<Two data-testid="two" style={[sheet.danger]} />)
    const a = screen.getByTestId('one').className.split(' ')
    const b = screen.getByTestId('two').className.split(' ')
    expect(a[1]).toBe(b[1])
    expect(rules().filter((rule) => rule.startsWith('@layer b-overrides{'))).toEqual([
      `@layer b-overrides{.${a[1]}{color:red;}}`,
    ])
    expect(
      rules().some((rule) => rule.includes('color:red;') && rule.startsWith('@layer b-components'))
    ).toBe(false)
    expect(screen.getByTestId('one').hasAttribute('style')).toBe(false)
  })

  it('merges two entries, an entry given twice, an entry and an object, and an engine class', () => {
    const { styled, StyleSheet, apply } = setup()
    const sheet = StyleSheet.create({ a: { color: 'red' }, b: { opacity: 1 } })
    const Box = styled('div', { name: 'Box' })({ margin: 1 })
    render(
      <>
        <Box data-testid="two" style={[sheet.a, sheet.b]} />
        <Box data-testid="dup" style={[sheet.a, [sheet.a]]} />
        <Box data-testid="mix" style={[sheet.a, { padding: 1 }]} />
        <Box data-testid="cls" {...apply(sheet.a)} style={sheet.b} />
      </>
    )
    for (const id of ['two', 'dup', 'mix', 'cls']) {
      const names = screen.getByTestId(id).className.split(' ')
      expect(names).toHaveLength(2)
      expect(names[1]).toMatch(/^b-box-root-/)
    }
  })

  it('writes both rules, one for each role, when the entry is also applied to a plain element', () => {
    const { styled, StyleSheet, apply, rules } = setup()
    const sheet = StyleSheet.create({ a: { color: 'red' } })
    const Box = styled('div')({ margin: 1 })
    render(
      <>
        <Box data-testid="box" style={sheet.a} />
        <p data-testid="plain" {...apply(sheet.a)} />
      </>
    )
    const override = screen.getByTestId('box').className.split(' ')[1]
    const own = screen.getByTestId('plain').className
    expect(own).not.toBe(override)
    expect(rules()).toContain(`@layer b-components{.${own}{color:red;}}`)
    expect(rules()).toContain(`@layer b-overrides{.${override}{color:red;}}`)
  })

  it('is not written again by a client that read the ids a server render left', () => {
    const make = () => {
      const engine = createEngine(baseTheme, {
        prefix: 'b',
        cache: createCache({ hasPruning: false, prefix: 'b', sheet: createMemorySheet() }),
      })
      return bindEngine(engine)
    }
    const server = make()
    const serverSheet = server.StyleSheet.create({ a: { color: 'red' } })
    const Served = server.styled('div')({ margin: 1 })
    const served = render(<Served data-testid="s" style={serverSheet.a} />)
    const names = screen.getByTestId('s').className
    served.unmount()
    document.head.innerHTML = createStyleTag(server.cache)
    const element = document.querySelector('style[data-style="b"]') as HTMLStyleElement
    const before = element.sheet?.cssRules.length
    const client = bindEngine(createEngine(baseTheme, { prefix: 'b', hasPruning: false }))
    const clientSheet = client.StyleSheet.create({ a: { color: 'red' } })
    const Again = client.styled('div')({ margin: 1 })
    render(<Again data-testid="c" style={clientSheet.a} />)
    expect(screen.getByTestId('c').className).toBe(names)
    expect(element.sheet?.cssRules.length).toBe(before)
  })
})

describe('an object sheet has no hook', () => {
  it('is usable at once, with no provider, and useStyle returns the same object', () => {
    const { StyleSheet, useStyle } = setup()
    const sheet = StyleSheet.create({ box: { color: 'red' } })
    expect(readSheet(useStyle, sheet)).toBe(sheet)
    expect(sheet.box.className).toMatch(/^b-/)
  })

  it('works on a default style with no theme, and before configure is called', () => {
    const style = createDefaultStyle()
    const sheet = style.StyleSheet.create({ box: { color: 'red' } })
    expect(Object.keys(sheet)).toEqual(['box'])
    expect(() =>
      style.configure({ prefix: 'late', theme: baseTheme as unknown as Theme })
    ).not.toThrow()
    const Box = style.styled('div')({ margin: 1 })
    render(<Box data-testid="b" style={sheet.box} />)
    expect(screen.getByTestId('b').className.split(' ')).toHaveLength(2)
    expect(sheet.box.className).toMatch(/^late-/)
    expect(readSheet(style.useStyle, sheet)).toEqual(sheet)
    expect(style.getEngine().hasTheme).toBe(true)
  })

  it('keeps a sheet that is a function of the theme as it was: useStyle resolves it', () => {
    const { StyleSheet, useStyle, ThemeProvider } = setup()
    const sheet = StyleSheet.create((theme) => ({ box: { color: theme.palette.primary } }))
    const entries = readSheet(useStyle, sheet)
    expect(entries.box.className).toMatch(/^b-/)
    const inside: unknown[] = []
    const Probe = () => {
      inside.push(useStyle(sheet))
      return null
    }
    render(
      <ThemeProvider theme={baseTheme}>
        <Probe />
      </ThemeProvider>
    )
    expect(inside).toHaveLength(1)
  })
})

describe('a sheet made from a function with no theme at all', () => {
  it('is called with an empty theme, so reading a token throws, where an object sheet works', () => {
    const engine = createLazyEngine<AppTheme>({
      prefix: 'z',
      cache: createCache({ prefix: 'z', sheet: createMemorySheet() }),
    })
    const { StyleSheet, useStyle } = bindEngine(engine)
    const themed = StyleSheet.create((view) => ({ box: { color: view.palette.primary } }))
    const plain = StyleSheet.create({ box: { color: 'red' } })
    expect(readSheet(useStyle, plain)).toBe(plain)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => readSheet(useStyle, themed)).toThrow(TypeError)
    spy.mockRestore()
  })
})

/** What `useStyle` returns for `sheet`, read in a component. */
function readSheet<T>(useStyle: (sheet: never) => T, sheet: unknown): T {
  let result: T | undefined
  const Probe = () => {
    result = useStyle(sheet as never)
    return null
  }
  render(<Probe />)
  return result as T
}
