import { render, screen } from '@testing-library/react'
import { at, createCache, createMemorySheet, isSheetEntry } from '@umber-style/core'
import { createStyle } from './createStyle'

const theme = { palette: { primary: '#0000ff' }, space: [0, 4, 8] }

/** What `css` throws for a function, as an argument or as an interpolation: the message of every binding. */
const FUNCTION_ERROR = new TypeError(
  "css(): a function is not a style here, as an argument or as an interpolation: css() makes a class with no component, so it has no props or theme to call it with. For a value of the props, use a styled component's style function; for a value of the theme, give an entry of StyleSheet.create((theme) => ...) to the style prop."
)

function setup() {
  const sheet = createMemorySheet()
  const style = createStyle(theme, { prefix: 'c', cache: createCache({ prefix: 'c', sheet }) })
  /** The rules of the class `className`, layer included. */
  const rulesOf = (className: string) =>
    sheet.rules.filter((rule) => rule.includes(`.${className}`))
  return { ...style, sheet, rulesOf }
}

describe('css', () => {
  it('returns one sheet entry of the merged style, the last winning, and writes nothing yet', () => {
    const { css, sheet } = setup()
    const card = css({ color: 'red', padding: 8 }, [false, null, undefined], { color: 'blue' })
    expect(isSheetEntry(card)).toBe(true)
    expect(sheet.rules).toEqual([])
    expect(String(card)).toBe(card.className)
    expect(sheet.rules).toEqual([
      '@layer c-theme,c-global,c-components,c-overrides;',
      `@layer c-components{.${card.className}{padding:8px;color:blue;}}`,
    ])
  })

  it('gives equal styles the same class', () => {
    const { css } = setup()
    expect(css({ color: 'red' }).className).toBe(css([{ color: 'red' }]).className)
    expect(css({ color: 'red' }).className).not.toBe(css({ color: 'blue' }).className)
  })

  it('works as a className, as text', () => {
    const { css } = setup()
    const card = css({ margin: 1 })
    render(<p data-testid="p" className={String(card)} />)
    expect(screen.getByTestId('p').className).toBe(card.className)
  })

  it('works in the style prop of a styled component, alone as its own class, or in a list', () => {
    const { css, styled, rulesOf } = setup()
    const danger = css({ backgroundColor: 'firebrick' })
    const Button = styled('button', { name: 'Button' })({ color: 'white' })
    render(<Button data-testid="alone" style={danger} />)
    const alone = screen.getByTestId('alone')
    const [own, override] = alone.className.split(' ')
    expect(rulesOf(override)).toEqual([
      `@layer c-overrides{.${override}{background-color:firebrick;}}`,
    ])
    expect(own).toMatch(/^c-button-root-/)
    render(<Button data-testid="list" style={[danger, { opacity: 0.5 }]} />)
    const merged = screen.getByTestId('list').className.split(' ')[1]
    expect(rulesOf(merged)).toEqual([
      `@layer c-overrides{.${merged}{background-color:firebrick;opacity:0.5;}}`,
    ])
    expect(alone.hasAttribute('style')).toBe(false)
  })

  it('works inside another css(), in apply and among the styles of styled', () => {
    const { css, apply, styled, rulesOf, sheet } = setup()
    const base = css({ color: 'red', padding: 1 })
    const loud = css(base, { color: 'blue' })
    expect(sheet.rules).toEqual([])
    const { className } = apply(loud)
    expect(className).toBe(loud.className)
    expect(rulesOf(loud.className)).toEqual([
      `@layer c-components{.${loud.className}{padding:1px;color:blue;}}`,
    ])
    const Box = styled('div')(base, { margin: 0 })
    const Same = styled('div')(base)
    render(<Box data-testid="box" />)
    render(<Same data-testid="same" />)
    const box = screen.getByTestId('box').className
    expect(rulesOf(box)).toEqual([`@layer c-components{.${box}{color:red;padding:1px;margin:0;}}`])
    expect(screen.getByTestId('same').className).toBe(base.className)
  })

  it('works under a selector of global styles', () => {
    const { css, Global, sheet } = setup()
    const reset = css({ margin: 0 })
    render(<Global styles={{ body: reset }} />)
    expect(sheet.rules).toContain('@layer c-global{body{margin:0;}}')
  })

  it('has the name and the text of its style, the real values of a theme read with useTheme, and writes no rule for them', () => {
    const { css, useTheme, ThemeProvider, Global, sheet } = setup()
    // An app's helper: css() of an object built from the real theme.
    const createGlobalStyles = (real: typeof theme) =>
      css({ '&::backdrop': { backgroundColor: real.palette.primary }, border: 'none' })
    let value: ReturnType<typeof createGlobalStyles> | undefined
    function Reader() {
      value = createGlobalStyles(useTheme())
      return <Global styles={{ dialog: value }} />
    }
    render(
      <ThemeProvider theme={theme}>
        <Reader />
      </ThemeProvider>
    )
    const { name, styles } = value as ReturnType<typeof createGlobalStyles>
    expect(styles).toBe('border:none;&::backdrop{background-color:#0000ff;}')
    expect(name).toMatch(/^c-\w+$/)
    expect(sheet.rules.some((rule) => rule.includes(`.${name}`))).toBe(false)
    expect(sheet.rules.filter((rule) => rule.includes('dialog'))).toEqual([
      '@layer c-global{dialog{border:none;}}',
      '@layer c-global{dialog::backdrop{background-color:#0000ff;}}',
    ])
    render(<p data-testid="alone" className={String(value)} />)
    expect(screen.getByTestId('alone').className).toBe(name)
  })

  it('reads a tagged template as CSS text, and gives the class of the equal object', () => {
    const { css } = setup()
    const card = css`
      padding: 8px;
      &:hover {
        opacity: ${0.5};
      }
    `
    expect(card.className).toBe(css({ padding: 8, '&:hover': { opacity: 0.5 } }).className)
  })

  it('throws a TypeError that says what to use for a function, alone, in a list or in a template', () => {
    const { css } = setup()
    expect(() => css((() => ({ color: 'red' })) as never)).toThrow(FUNCTION_ERROR)
    expect(() => css({ margin: 0 }, [(() => ({ color: 'red' })) as never])).toThrow(FUNCTION_ERROR)
    expect(
      () => css`
        color: ${(() => 'red') as never};
      `
    ).toThrow(FUNCTION_ERROR)
  })
})

describe('the template form of styled', () => {
  it('gives the CSS of the equal object style, in the base class', () => {
    const { styled, rulesOf } = setup()
    const Template = styled('div', { name: 'Card' })`
      color: red;
      &:hover {
        opacity: 0.8;
      }
      @media (min-width: 600px) {
        font-size: 2rem;
      }
    `
    const Object = styled('div', { name: 'Card' })({
      color: 'red',
      '&:hover': { opacity: 0.8 },
      '@media (min-width: 600px)': { fontSize: '2rem' },
    })
    render(<Template data-testid="t" />)
    render(<Object data-testid="o" />)
    const template = screen.getByTestId('t').className
    expect(template).toBe(screen.getByTestId('o').className)
    expect(rulesOf(template)).toHaveLength(3)
  })

  it('works with a tag shorthand, and keeps shouldForwardProp, as and target', () => {
    const { styled } = setup()
    const Link = styled.a`
      color: red;
    `
    const Box = styled('div', {
      target: 'box',
      shouldForwardProp: (prop): boolean => prop !== 'id',
    })`
      margin: 0;
    `
    render(<Link data-testid="a" href="#top" />)
    render(<Box data-testid="b" id="hidden" as="section" />)
    expect(screen.getByTestId('a').getAttribute('href')).toBe('#top')
    const box = screen.getByTestId('b')
    expect(box.tagName).toBe('SECTION')
    expect(box.hasAttribute('id')).toBe(false)
    expect(box.className.split(' ')).toContain('box')
  })

  it('makes the style depend on props when an interpolation reads them: a props class', () => {
    const { styled, rulesOf } = setup()
    const Title = styled('h1')<{ tone: string }>`
      margin: 0;
      color: ${({ tone }) => tone};
    `
    render(<Title data-testid="red" tone="red" />)
    render(<Title data-testid="blue" tone="blue" />)
    const red = screen.getByTestId('red').className
    const blue = screen.getByTestId('blue').className
    expect(red).not.toBe(blue)
    expect(rulesOf(red)).toEqual([`@layer c-components{.${red}{margin:0;color:red;}}`])
  })

  it('keeps a template whose functions read only the theme in the base class, with the theme as references', () => {
    const { styled, rulesOf } = setup()
    const Title = styled('h1')`
      color: ${({ theme: view }) => view.palette.primary};
      padding: ${({ theme: view }) => view.space[2]}px;
    `
    render(<Title data-testid="a" />)
    render(<Title data-testid="b" />)
    const className = screen.getByTestId('a').className
    expect(className.split(' ')).toHaveLength(1)
    expect(screen.getByTestId('b').className).toBe(className)
    expect(rulesOf(className)[0]).toContain('color:var(--c-palette-primary);')
  })

  it('merges a css() value that stands alone between declarations', () => {
    const { styled, css, rulesOf } = setup()
    const card = css({ padding: 8 })
    const Card = styled('div')`
      ${card}
      color: red;
    `
    render(<Card data-testid="c" />)
    const className = screen.getByTestId('c').className
    expect(rulesOf(className)).toEqual([
      `@layer c-components{.${className}{padding:8px;color:red;}}`,
    ])
  })
})

describe('a styled component as a selector', () => {
  it('is its target when it has one, in a template and in a key', () => {
    const { styled, rulesOf } = setup()
    const Icon = styled('span', { target: 'icon' })(({ theme: view }) => ({
      color: view.palette.primary,
    }))
    const Button = styled('button')`
      ${Icon} {
        margin: 0;
      }
    `
    const Other = styled('button')(at(`&:hover ${Icon}`, { margin: 1 }))
    expect(String(Icon)).toBe('.icon')
    render(<Button data-testid="b" />)
    render(<Other data-testid="o" />)
    const button = screen.getByTestId('b').className
    expect(rulesOf(button)).toEqual([`@layer c-components{.${button} .icon{margin:0;}}`])
    const other = screen.getByTestId('o').className
    expect(rulesOf(other)).toEqual([`@layer c-components{.${other}:hover .icon{margin:1px;}}`])
  })

  it('is its class when none of its styles is a function: the class every element of it has', () => {
    const { styled } = setup()
    const Icon = styled('span', { name: 'Icon' })({ display: 'inline-block' })
    render(<Icon data-testid="i" />)
    expect(String(Icon)).toBe(`.${screen.getByTestId('i').className}`)
  })

  it('throws a TypeError that asks for a target when a style is a function', () => {
    const { styled } = setup()
    const Icon = styled('span')<{ size: number }>(({ size }) => ({ width: size }))
    expect(() => String(Icon)).toThrow(TypeError)
    expect(
      () => styled('div')`
        ${Icon} {
          margin: 0;
        }
      `
    ).toThrow('give it a `target`')
  })
})

describe('the template form of keyframes and globalStyles', () => {
  it('gives the name of the equal steps, written when a class uses it', () => {
    const { keyframes, styled, sheet } = setup()
    const fade = keyframes`
      from { opacity: 0; }
      to { opacity: 1; }
    `
    expect(fade).toBe(keyframes({ from: { opacity: 0 }, to: { opacity: 1 } }))
    const Box = styled('div')`
      animation: ${fade} 1s;
    `
    render(<Box />)
    expect(sheet.rules).toContain(`@keyframes ${fade}{0%{opacity:0;}100%{opacity:1;}}`)
  })

  it('makes global styles from CSS text, a function called with { theme }', () => {
    const { globalStyles, Global, sheet } = setup()
    const reset = globalStyles`
      body { margin: 0; color: ${({ theme: view }) => view.palette.primary}; }
    `
    render(<Global styles={reset} />)
    expect(sheet.rules).toContain('@layer c-global{body{margin:0;color:var(--c-palette-primary);}}')
  })
})
