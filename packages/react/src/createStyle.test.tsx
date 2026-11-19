import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { createCache, createMemorySheet } from '@umber-style/core'

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
import { createStyle } from './createStyle'

const baseTheme = {
  palette: { primary: '#0000ff', text: '#111111' },
  space: { small: 4 },
  breakpoints: { md: 768 },
}

/** A style with its own in-memory sheet, so that a test can read the rules. */
function setup(prefix = 't') {
  const sheet = createMemorySheet()
  const style = createStyle(baseTheme, {
    prefix,
    cache: createCache({ hasLayers: false, prefix, sheet }),
  })
  const ruleOf = (className: string) =>
    sheet.rules.find((rule) => rule.startsWith(`.${className}{`))
  return { ...style, sheet, ruleOf }
}

describe('styled', () => {
  it('makes a class named after the label, with the theme as variable references', () => {
    const { styled, sheet } = setup()
    const Button = styled('button', { name: 'Button' })(({ theme }) => ({
      color: theme.palette.primary,
    }))
    render(<Button>hi</Button>)
    expect(screen.getByRole('button').className).toMatch(/^t-button-root-[a-z0-9]+$/)
    expect(sheet.rules.join('')).toContain('color:var(--t-palette-primary);')
  })

  it('names a slot and turns camel case into kebab case', () => {
    const { styled } = setup()
    const Label = styled('span', { name: 'IconButton', slot: 'startLabel' })({ color: 'red' })
    render(<Label>x</Label>)
    expect(screen.getByText('x').className).toMatch(/^t-icon-button-start-label-/)
  })

  it('adds no label without a name', () => {
    const { styled } = setup()
    const Plain = styled('span')({ color: 'red' })
    render(<Plain>x</Plain>)
    expect(screen.getByText('x').className).toMatch(/^t-[a-z0-9]+$/)
  })

  it('renders no class attribute when there is nothing to put in it', () => {
    const { styled } = setup()
    const Empty = styled('span')()
    render(<Empty>x</Empty>)
    expect(screen.getByText('x').hasAttribute('class')).toBe(false)
  })

  it('merges its class with the one it is given: one engine class, the later style wins', () => {
    const { styled, cache, ruleOf } = setup()
    const Button = styled('button')({ color: 'red', margin: 4 })
    const other = cache.css({ color: 'blue' })
    render(<Button className={`${other} external`}>x</Button>)
    const classes = screen.getByRole('button').className.split(' ')
    expect(classes).toHaveLength(2)
    expect(classes).toContain('external')
    const engine = classes.find((name) => name.startsWith('t-')) as string
    expect(ruleOf(engine)).toBe(`.${engine}{margin:4px;color:blue;}`)
  })

  it('merges with the class that apply() makes from a sheet', () => {
    const { styled, StyleSheet, useStyle, apply, ruleOf } = setup()
    const sheet = StyleSheet.create({ tone: { color: 'green' } })
    const Button = styled('button')({ color: 'red' })
    const { tone } = readSheet(useStyle, sheet)
    render(<Button {...apply(tone)}>x</Button>)
    const { className } = screen.getByRole('button')
    expect(ruleOf(className)).toBe(`.${className}{color:green;}`)
  })

  it('flattens styling a styled component into one element and one class', () => {
    const { styled, ruleOf } = setup()
    const Base = styled('button', { name: 'Base' })({ color: 'red' })
    const Fancy = styled(Base, { name: 'Fancy' })({ margin: 4 })
    const { container } = render(<Fancy>x</Fancy>)
    expect(container.querySelectorAll('*')).toHaveLength(1)
    const { className } = screen.getByRole('button')
    expect(className).toMatch(/^t-fancy-root-[a-z0-9]+$/)
    expect(ruleOf(className)).toBe(`.${className}{color:red;margin:4px;}`)
    expect(Fancy._tag).toBe('button')
    expect(Fancy._styles).toHaveLength(4)
  })

  it('keeps the forwarding rule of the component it flattens', () => {
    const { styled } = setup()
    const Base = styled('div', { shouldForwardProp: (prop) => prop !== 'tone' })({ color: 'red' })
    const Fancy = styled(Base)({ margin: 4 })
    const { container } = render(<Fancy tone="x" data-x="y" title="t" />)
    const element = container.firstElementChild as HTMLElement
    expect(element.hasAttribute('tone')).toBe(false)
    expect(element.getAttribute('title')).toBe('t')
    expect(element.getAttribute('data-x')).toBe('y')
  })

  it('renders the element of `as`', () => {
    const { styled } = setup()
    const Button = styled('button')({ color: 'red' })
    const { container } = render(
      <Button as="a" href="#top">
        x
      </Button>
    )
    expect(container.querySelector('a')?.getAttribute('href')).toBe('#top')
    expect(container.querySelector('button')).toBeNull()
  })

  it('forwards every prop to a tag, but `as`, `theme` and `className`', () => {
    const { styled } = setup()
    const Box = styled('div')({ color: 'red' })
    const { container } = render(<Box tone="big" theme={{}} data-x="1" id="a" />)
    const element = container.firstElementChild as HTMLElement
    expect(element.getAttributeNames().sort()).toEqual(['class', 'data-x', 'id', 'tone'])
  })

  it('uses shouldForwardProp for a tag', () => {
    const { styled } = setup()
    const Box = styled('div', { shouldForwardProp: (prop) => prop === 'id' })({ color: 'red' })
    const { container } = render(<Box id="a" title="b" />)
    expect((container.firstElementChild as HTMLElement).getAttributeNames().sort()).toEqual([
      'class',
      'id',
    ])
  })

  it('forwards every prop but `as` and `theme` to a component', () => {
    const { styled } = setup()
    const Probe = (props: Record<string, unknown>) => (
      <i data-keys={Object.keys(props).sort().join()} />
    )
    const Box = styled(Probe)({ color: 'red' })
    const { container } = render(<Box $size="big" theme={{}} as={Probe} id="a" />)
    expect(container.firstElementChild?.getAttribute('data-keys')).toBe('$size,className,id')
  })

  it('passes the ref and the children on', () => {
    const { styled } = setup()
    const Button = styled('button')({ color: 'red' })
    const ref = createRef<HTMLButtonElement>()
    render(<Button ref={ref}>inside</Button>)
    expect(ref.current?.textContent).toBe('inside')
  })

  it('gives different classes for different props and the same class for the same prop', () => {
    const { styled } = setup()
    const Box = styled('div')<{ $size: number }>(({ $size }) => ({ padding: $size }))
    const { container } = render(
      <>
        <Box $size={4} />
        <Box $size={4} />
        <Box $size={8} />
      </>
    )
    const [first, second, third] = [...container.children].map((child) => child.className)
    expect(second).toBe(first)
    expect(third).not.toBe(first)
  })
})

describe('styled, the class of a style with no function', () => {
  it('is made once, and made again when a className is given', () => {
    const cache = createCache({ hasLayers: false, prefix: 't', sheet: createMemorySheet() })
    const spy = vi.spyOn(cache, 'css')
    const { styled } = createStyle(baseTheme, { prefix: 't', cache })
    const Box = styled('div')({ color: 'red' })
    const { rerender } = render(<Box data-testid="box" />)
    const first = screen.getByTestId('box').className
    expect(spy).toHaveBeenCalledTimes(1)
    rerender(<Box data-testid="box" />)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('box').className).toBe(first)
    rerender(<Box data-testid="box" className="extra" />)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('box').className).toBe(`extra ${first}`)
  })

  it('is made on every render when a style is a function', () => {
    const cache = createCache({ hasLayers: false, prefix: 't', sheet: createMemorySheet() })
    const spy = vi.spyOn(cache, 'css')
    const { styled } = createStyle(baseTheme, { prefix: 't', cache })
    const Box = styled('div')<{ $on?: boolean }>(({ $on }) => ({ color: $on ? 'red' : 'blue' }))
    const { rerender } = render(<Box data-testid="box" />)
    rerender(<Box data-testid="box" $on />)
    expect(spy).toHaveBeenCalledTimes(2)
  })
})

describe('ThemeProvider', () => {
  it('uses one component class under two themes, and one rule per theme class', () => {
    const { styled, ThemeProvider, sheet } = setup()
    const Button = styled('button')(({ theme }) => ({ color: theme.palette.primary }))
    const { container } = render(
      <ThemeProvider theme={baseTheme}>
        <Button>outer</Button>
        <ThemeProvider theme={{ palette: { primary: '#ff0000' } }}>
          <Button>inner</Button>
        </ThemeProvider>
      </ThemeProvider>
    )
    expect(screen.getByText('inner').className).toBe(screen.getByText('outer').className)

    const outer = container.firstElementChild as HTMLElement
    const inner = outer.querySelector('div') as HTMLElement
    expect(inner.className).not.toBe(outer.className)
    expect(outer.hasAttribute('style')).toBe(false)

    const themeRules = sheet.rules.filter((rule) => rule.startsWith('.t-theme-'))
    expect(themeRules).toHaveLength(2)
    expect(themeRules).toContain(`.${inner.className.split(' ')[0]}{--t-palette-primary:#ff0000;}`)
    expect(themeRules.find((rule) => rule.startsWith(`.${outer.className.split(' ')[0]}{`))).toBe(
      `.${outer.className.split(' ')[0]}{--t-palette-primary:#0000ff;--t-palette-text:#111111;--t-space-small:4px;}`
    )
  })

  it('renders the element of `as`, adds a class, and sets the color scheme', () => {
    const { ThemeProvider, sheet } = setup()
    const { container } = render(
      <ThemeProvider theme={{}} as="section" className="mine" colorScheme="dark">
        x
      </ThemeProvider>
    )
    const element = container.firstElementChild as HTMLElement
    expect(element.tagName).toBe('SECTION')
    expect(element.className).toMatch(/^t-theme-[a-z0-9]+ t-scope mine$/)
    expect(sheet.rules.find((rule) => rule.includes('color-scheme'))).toMatch(
      /color-scheme:dark;\}$/
    )
  })

  it('changes the variables by changing the class, with no render', () => {
    const prefix = 'sw'
    const { styled, ThemeProvider, themeClass } = createStyle(baseTheme, { prefix })
    let renders = 0
    const Probe = (props: Record<string, unknown>) => {
      renders++
      return <button {...props} />
    }
    const Button = styled(Probe)(({ theme }) => ({ color: theme.palette.primary }))
    const { container } = render(
      <ThemeProvider theme={baseTheme}>
        <Button>x</Button>
      </ThemeProvider>
    )
    const wrapper = container.firstElementChild as HTMLElement
    const button = screen.getByRole('button')
    const read = (element: Element) =>
      getComputedStyle(element).getPropertyValue('--sw-palette-primary')
    const before = read(button)
    const classBefore = button.className

    wrapper.className = themeClass({ palette: { primary: '#ff0000' } })
    expect(read(wrapper)).toBe('#ff0000')
    expect(before).toBe('#0000ff')
    expect(read(button)).toBe('#ff0000')
    expect(button.className).toBe(classBefore)
    expect(renders).toBe(1)
  })
})

describe('themeClass', () => {
  it('reads a theme object once for each colour scheme', () => {
    const { themeClass, sheet } = setup()
    let reads = 0
    const theme = {
      palette: {
        get primary() {
          reads++
          return '#ff0000'
        },
      },
    }
    const first = themeClass(theme)
    expect(themeClass(theme)).toBe(first)
    expect(reads).toBe(1)
    const dark = themeClass(theme, 'dark')
    expect(dark).not.toBe(first)
    expect(themeClass(theme, 'dark')).toBe(dark)
    expect(reads).toBe(2)
    expect(sheet.rules).toHaveLength(2)
  })

  it('makes the same class for another object with the same values', () => {
    const { themeClass } = setup()
    expect(themeClass({ palette: { primary: '#fff' } })).toBe(
      themeClass({ palette: { primary: '#fff' } })
    )
  })
})

describe('useTheme', () => {
  it('returns the real values and merges a nested partial theme', () => {
    const { ThemeProvider, useTheme } = setup()
    const seen: unknown[] = []
    const Probe = () => {
      seen.push(useTheme())
      return null
    }
    render(
      <>
        <Probe />
        <ThemeProvider theme={{ palette: { primary: '#ff0000' } }}>
          <ThemeProvider theme={{ space: { small: 8 } }}>
            <Probe />
          </ThemeProvider>
        </ThemeProvider>
      </>
    )
    expect(seen[0]).toEqual(baseTheme)
    expect(seen[1]).toEqual({
      palette: { primary: '#ff0000', text: '#111111' },
      space: { small: 8 },
      breakpoints: { md: 768 },
    })
  })
})

describe('StyleSheet, useStyle and apply', () => {
  it('makes the classes on first use and returns the same map every time', () => {
    const { StyleSheet, useStyle, sheet: rules } = setup()
    const sheet = StyleSheet.create({ box: { color: 'red' }, text: { color: 'blue' } })
    expect(rules.rules).toHaveLength(0)
    const first = readSheet(useStyle, sheet)
    expect(readSheet(useStyle, sheet)).toBe(first)
    expect(Object.keys(first)).toEqual(['box', 'text'])
    expect(rules.rules).toHaveLength(2)
  })

  it('gives a function the variable references', () => {
    const { StyleSheet, useStyle, ruleOf } = setup()
    const sheet = StyleSheet.create((theme) => ({ box: { color: theme.palette.primary } }))
    const { box } = readSheet(useStyle, sheet)
    expect(ruleOf(box)).toBe(`.${box}{color:var(--t-palette-primary);}`)
  })

  it('apply makes one class from its entries, and none from nothing', () => {
    const { StyleSheet, useStyle, apply, ruleOf } = setup()
    const sheet = StyleSheet.create({ a: { color: 'red', margin: 1 }, b: { color: 'blue' } })
    const { a, b } = readSheet(useStyle, sheet)
    const { className } = apply(a, null, b, false, undefined)
    expect(ruleOf(className as string)).toBe(`.${className}{margin:1px;color:blue;}`)
    expect(apply()).toEqual({ className: undefined })
  })
})

describe('createStyle', () => {
  it('makes a cache from its options, and names variables like its classes', () => {
    const style = createStyle(baseTheme, { prefix: 'my', suffix: '-s', hasLabels: false })
    expect(style.cache.prefix).toBe('my')
    const { box } = readSheet(style.useStyle, style.StyleSheet.create({ box: { color: 'red' } }))
    expect(box.className).toMatch(/^my-[a-z0-9]+-s$/)
    expect(style.themeClass({ palette: { primary: '#fff' } })).toMatch(/^my-theme-/)
  })

  it('takes its prefix from a given cache, then from the default', () => {
    const cache = createCache({ hasLayers: false, prefix: 'given', sheet: createMemorySheet() })
    const given = createStyle(baseTheme, { cache })
    expect(given.cache).toBe(cache)
    expect(given.themeClass({})).toMatch(/^given-theme-/)
    expect(createStyle(baseTheme).cache.prefix).toBe('css')
  })

  it('leaves raw keys without variables', () => {
    const { sheet, StyleSheet, useStyle } = setup()
    readSheet(
      useStyle,
      StyleSheet.create((theme) => ({ box: { width: theme.breakpoints.md } }))
    )
    expect(sheet.rules.join('')).toContain('width:768px;')
  })
})

describe('the wrapper of a ThemeProvider', () => {
  it('has only classes, and computes display: contents, which a theme class alone does not set', () => {
    const { ThemeProvider, themeClass } = createStyle(baseTheme, { prefix: 'dc' })
    const { container } = render(
      <ThemeProvider theme={baseTheme}>
        <i />
      </ThemeProvider>
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.hasAttribute('style')).toBe(false)
    expect(getComputedStyle(wrapper).display).toBe('contents')

    const plain = document.createElement('div')
    plain.className = themeClass(baseTheme)
    document.body.append(plain)
    expect(getComputedStyle(plain).display).not.toBe('contents')
  })
})

describe('the wrapper of a ThemeProvider', () => {
  it('has only classes, and computes display: contents, which a theme class alone does not set', () => {
    const { ThemeProvider, themeClass } = createStyle(baseTheme, { prefix: 'dc' })
    const { container } = render(
      <ThemeProvider theme={baseTheme}>
        <i />
      </ThemeProvider>
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.hasAttribute('style')).toBe(false)
    expect(getComputedStyle(wrapper).display).toBe('contents')

    const plain = document.createElement('div')
    plain.className = themeClass(baseTheme)
    document.body.append(plain)
    expect(getComputedStyle(plain).display).not.toBe('contents')
  })
})
