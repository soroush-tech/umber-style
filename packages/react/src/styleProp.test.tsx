import { render, screen } from '@testing-library/react'
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

const baseTheme = { palette: { primary: '#0000ff' }, space: [0, 4, 8] }

function setup() {
  const sheet = createMemorySheet()
  const style = createStyle(baseTheme, { prefix: 's', cache: createCache({ prefix: 's', sheet }) })
  const ruleOf = (className: string) =>
    sheet.rules.find((rule) => rule.startsWith(`.${className}{`))
  const entries = style.StyleSheet.create((theme) => ({
    container: { padding: theme.space[2] },
    active: { background: theme.palette.primary },
    loud: { color: 'blue' },
  }))
  return { ...style, sheet, ruleOf, classes: readSheet(style.useStyle, entries) }
}

describe('the style prop of a styled component', () => {
  it('turns sheet entries into the one class, after the styles, and keeps plain objects inline', () => {
    const { styled, classes, ruleOf } = setup()
    const View = styled('div', { name: 'View' })({ color: 'red', margin: 1 })
    render(
      <View
        data-testid="v"
        style={[classes.container, false, [classes.loud, null], { opacity: 0.9 }, undefined]}
      />
    )
    const element = screen.getByTestId('v')
    expect(element.className.split(' ')).toHaveLength(1)
    expect(ruleOf(element.className)).toBe(
      `.${element.className}{margin:1px;padding:var(--s-space-2);color:blue;opacity:0.9;}`
    )
    expect(element.hasAttribute('style')).toBe(false)
  })

  it('renders no style attribute when only entries are given', () => {
    const { styled, classes } = setup()
    const View = styled('div')({ color: 'red' })
    render(<View data-testid="v" style={classes.container} />)
    expect(screen.getByTestId('v').hasAttribute('style')).toBe(false)
  })

  it('merges a plain style object into the class: no style attribute', () => {
    const { styled, ruleOf } = setup()
    const View = styled('div')({ color: 'red' })
    render(<View data-testid="v" style={{ opacity: 0.5, width: 3 }} />)
    const element = screen.getByTestId('v')
    expect(element.hasAttribute('style')).toBe(false)
    expect(ruleOf(element.className)).toBe(
      `.${element.className}{color:red;opacity:0.5;width:3px;}`
    )
  })

  it('puts a given className last, after the entries', () => {
    const { styled, classes, cache, ruleOf } = setup()
    const View = styled('div')({ color: 'red' })
    const other = cache.css({ color: 'green' })
    render(<View data-testid="v" className={`${other} external`} style={classes.loud} />)
    const [external, engineClass] = screen.getByTestId('v').className.split(' ')
    expect(external).toBe('external')
    expect(ruleOf(engineClass)).toBe(`.${engineClass}{color:green;}`)
  })

  it('gives an empty View no class and no style', () => {
    const { styled } = setup()
    const View = styled('div', { name: 'View' })()
    render(<View data-testid="v" />)
    const element = screen.getByTestId('v')
    expect(element.hasAttribute('class')).toBe(false)
    expect(element.hasAttribute('style')).toBe(false)
  })

  it('leaves a nested rule of the component alone: an entry does not override its hover', () => {
    const { styled, classes, ruleOf } = setup()
    const View = styled('div')({ color: 'red', '&:hover': { color: 'orange' } })
    render(<View data-testid="v" style={classes.loud} />)
    const { className } = screen.getByTestId('v')
    const base = ruleOf(className)
    expect(base).toBe(`.${className}{color:blue;}`)
    // The hover rule of the component still sets orange: that is the surprise.
    expect(ruleOf(`${className}:hover`)).toBe(`.${className}:hover{color:orange;}`)
  })
})

describe('apply with entries', () => {
  it('puts entries, class names and nothing on a plain element', () => {
    const { apply, classes, ruleOf } = setup()
    const { className } = apply(classes.container, null, classes.active, 'external', false)
    const [external, engineClass] = (className as string).split(' ')
    expect(external).toBe('external')
    expect(ruleOf(engineClass)).toBe(
      `.${engineClass}{padding:var(--s-space-2);background:var(--s-palette-primary);}`
    )
  })
})

describe('overriding a Button through style', () => {
  function setupButton() {
    const { styled, StyleSheet, useStyle: readStyle, ruleOf, sheet } = setup()
    const Button = styled('button', { name: 'Button' })<{ variant?: string }>(({ theme }) => ({
      background: theme.palette.primary,
      borderRadius: 8,
      padding: 4,
      '&:hover:not(:disabled)': { background: 'darkblue' },
    }))
    const styles = readSheet(
      readStyle,
      StyleSheet.create({
        custom: { background: 'rebeccapurple', borderRadius: 0 },
        hover: { '&:hover:not(:disabled)': { background: 'rebeccapurple' } },
      })
    )
    return { Button, styles, ruleOf, sheet }
  }

  it('wins on its own properties, keeps the rest and the label, in one class', () => {
    const { Button, styles, ruleOf } = setupButton()
    render(
      <Button variant="filled" style={styles.custom}>
        custom
      </Button>
    )
    const { className } = screen.getByText('custom')
    expect(className).toMatch(/^s-button-root-/)
    expect(className.split(' ')).toHaveLength(1)
    expect(ruleOf(className)).toBe(
      `.${className}{padding:4px;background:rebeccapurple;border-radius:0;}`
    )
  })

  it('does not reach the hover rule of the Button, unless the entry has its own', () => {
    const { Button, styles, ruleOf } = setupButton()
    render(<Button style={styles.custom}>plain</Button>)
    const plain = screen.getByText('plain').className
    expect(ruleOf(`${plain}:hover:not(:disabled)`)).toBe(
      `.${plain}:hover:not(:disabled){background:darkblue;}`
    )
    render(<Button style={[styles.custom, styles.hover]}>own</Button>)
    const own = screen.getByText('own').className
    expect(ruleOf(`${own}:hover:not(:disabled)`)).toBe(
      `.${own}:hover:not(:disabled){background:rebeccapurple;}`
    )
  })

  it('combines an entry with a plain object in the one class', () => {
    const { Button, styles, ruleOf } = setupButton()
    render(<Button style={[styles.custom, { opacity: 0.7 }]}>both</Button>)
    const both = screen.getByText('both')
    expect(both.hasAttribute('style')).toBe(false)
    expect(both.className.split(' ')).toHaveLength(1)
    expect(ruleOf(both.className)).toContain('opacity:0.7;')
  })
})

describe('a string style', () => {
  it('is an error: a text style cannot be merged into a class', () => {
    const { styled } = setup()
    const View = styled('div')({ color: 'red' })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<View style={'width: 3px' as never} />)).toThrow('cannot be merged')
  })
})
