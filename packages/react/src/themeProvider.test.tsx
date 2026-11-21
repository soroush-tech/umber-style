import { act, render, screen } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { createCache, createLazyEngine, createMemorySheet } from '@umber-style/core'
import { bindEngine, createStyle } from './createStyle'
import { createDefaultStyle } from './defaultStyle'

const light = {
  palette: { primary: '#0000ff', text: '#111111' },
  breakpoints: Object.defineProperty({ values: { md: 768 } }, 'up', {
    value: (key: string) => `@media (min-width: ${key})`,
  }),
}
const dark = { palette: { primary: '#8888ff', text: '#eeeeee' } }

afterEach(() => {
  document.head.innerHTML = ''
  document.documentElement.className = ''
})

/** A style with its own in-memory sheet, so that a test reads the rules. */
function setup() {
  const sheet = createMemorySheet()
  const style = createStyle(light, {
    prefix: 't',
    cache: createCache({ hasLayers: false, prefix: 't', sheet }),
  })
  const roots = () => sheet.rules.filter((rule) => rule.startsWith(':where(:root)'))
  const ruleOf = (id: string) => sheet.rules.find((rule) => rule.startsWith(`.${id}{`))
  return { ...style, sheet, roots, ruleOf }
}

/** A styled component that counts its renders, with a function style that reads a token. */
function createCounted(style: ReturnType<typeof setup>) {
  const renders = { count: 0 }
  const Probe = (props: Record<string, unknown>) => {
    renders.count++
    return <b {...props} />
  }
  const Text = style.styled(Probe)(({ theme }) => ({ color: theme.palette.primary }))
  return { Text, renders }
}

/** Renders `children` (made once, outside) under a provider whose theme the returned function changes. */
function renderSwitch(
  Provider: (props: { theme: object; children?: ReactNode }) => ReactNode,
  first: object,
  children: ReactNode
) {
  let change: (theme: object) => void = () => undefined
  function Switch({ content }: { content: ReactNode }) {
    const [theme, setTheme] = useState(first)
    change = setTheme
    return <Provider theme={theme}>{content}</Provider>
  }
  const result = render(<Switch content={children} />)
  return { ...result, change: (theme: object) => act(() => change(theme)) }
}

describe('the outermost provider', () => {
  it('renders no element and puts no class on <html>: its theme is declared on :root', () => {
    const style = setup()
    const { Text } = createCounted(style)
    const { container } = render(
      <style.ThemeProvider theme={light} colorScheme="dark">
        <Text>x</Text>
      </style.ThemeProvider>
    )
    expect(container.innerHTML).toMatch(/^<b class="t-[a-z0-9]+">x<\/b>$/)
    expect(document.documentElement.className).toBe('')
    expect(style.roots()).toEqual([':where(:root){--t-palette-primary:#0000ff;color-scheme:dark;}'])
  })

  it('rewrites the :root rule when its theme changes, and renders no styled component again', () => {
    const style = setup()
    const { Text, renders } = createCounted(style)
    const seen: string[] = []
    const Reader = () => {
      seen.push(style.useTheme().palette.primary)
      return null
    }
    const { change } = renderSwitch(
      style.ThemeProvider,
      light,
      <>
        <Text>x</Text>
        <Reader />
      </>
    )
    const before = screen.getByText('x').className
    change({ ...light, ...dark })
    expect(style.roots()).toEqual([':where(:root){--t-palette-primary:#8888ff;}'])
    expect(renders.count).toBe(1)
    expect(screen.getByText('x').className).toBe(before)
    // What reads the real values does render again.
    expect(seen).toEqual(['#0000ff', '#8888ff'])
  })

  it('gives the theme to the context, merged over the base theme', () => {
    const style = setup()
    const seen: unknown[] = []
    render(
      <style.ThemeProvider theme={dark}>
        <style.ThemeContext.Consumer>
          {(theme) => {
            seen.push(theme)
            return null
          }}
        </style.ThemeContext.Consumer>
      </style.ThemeProvider>
    )
    expect(seen).toEqual([{ ...light, ...dark }])
  })

  it('has ThemeScope render its children alone, and useThemeClass give nothing', () => {
    const style = setup()
    let seen: string | undefined = 'unset'
    const Probe = () => {
      seen = style.useThemeClass()
      return <i />
    }
    const { container } = render(
      <style.ThemeProvider theme={light}>
        <style.ThemeScope>
          <Probe />
        </style.ThemeScope>
      </style.ThemeProvider>
    )
    expect(container.innerHTML).toBe('<i></i>')
    expect(seen).toBeUndefined()
  })

  it('shares :root with one side by side: the theme of the last one that committed is there', () => {
    const style = setup()
    const { Text } = createCounted(style)
    render(
      <>
        <style.ThemeProvider theme={light}>
          <Text>a</Text>
        </style.ThemeProvider>
        <style.ThemeProvider theme={dark}>
          <Text>b</Text>
        </style.ThemeProvider>
      </>
    )
    expect(screen.getByText('a').parentElement).toBe(screen.getByText('b').parentElement)
    expect(style.roots()).toEqual([':where(:root){--t-palette-primary:#8888ff;}'])
  })

  it('makes no :root rule with isRoot, and its children are under no wrapper', () => {
    const style = setup()
    const { container } = render(
      <style.ThemeProvider theme={light} isRoot>
        <style.ThemeScope>
          <i />
        </style.ThemeScope>
      </style.ThemeProvider>
    )
    expect(container.innerHTML).toBe('<i></i>')
    expect(style.roots()).toEqual([])
  })
})

describe('a nested provider', () => {
  it('renders one wrapper: the class of what it changes, of its whole merged theme, and the scope', () => {
    const style = setup()
    const { Text } = createCounted(style)
    const { container } = render(
      <style.ThemeProvider theme={light}>
        <style.ThemeProvider theme={{ palette: { primary: '#ff0000' } }}>
          <Text>x</Text>
        </style.ThemeProvider>
      </style.ThemeProvider>
    )
    const wrapper = container.firstElementChild as HTMLElement
    const [own, boundary, full, scope, ...rest] = wrapper.className.split(' ')
    expect([boundary, scope, rest]).toEqual(['t-boundary', 't-scope', []])
    expect(style.ruleOf(own)).toBe(`.${own}{--t-palette-primary:#ff0000;}`)
    // Every variable of its merged theme that is used, for where it is not inside the outer theme.
    style.engine.css({ color: style.engine.refs.palette.text })
    expect(style.ruleOf(full)).toBe(
      `.${full}{--t-palette-primary:#ff0000;--t-palette-text:#111111;}`
    )
  })

  it('changes its classes when its theme changes, and renders no styled component again', () => {
    const style = setup()
    const { Text, renders } = createCounted(style)
    function Nested({ theme, children }: { theme: object; children?: ReactNode }) {
      return (
        <style.ThemeProvider theme={light}>
          <style.ThemeProvider theme={theme}>{children}</style.ThemeProvider>
        </style.ThemeProvider>
      )
    }
    const { container, change } = renderSwitch(Nested, dark, <Text>x</Text>)
    const wrapper = container.firstElementChild as HTMLElement
    const before = wrapper.className
    change({ palette: { primary: '#00ff00' } })
    expect(wrapper.className).not.toBe(before)
    expect(container.firstElementChild).toBe(wrapper)
    expect(renders.count).toBe(1)
  })

  it('gives its wrapper to ThemeScope in a portal, and its class to useThemeClass', () => {
    const style = setup()
    const target = document.createElement('div')
    document.body.appendChild(target)
    let seen: string | undefined
    const Probe = () => {
      seen = style.useThemeClass()
      return <i>in portal</i>
    }
    const { container } = render(
      <style.ThemeProvider theme={light}>
        <style.ThemeProvider theme={dark} colorScheme="dark" as="section">
          {createPortal(
            <style.ThemeScope>
              <Probe />
            </style.ThemeScope>,
            target
          )}
        </style.ThemeProvider>
      </style.ThemeProvider>
    )
    const wrapper = container.firstElementChild as HTMLElement
    const repeated = screen.getByText('in portal').parentElement as HTMLElement
    expect(repeated.parentElement).toBe(target)
    expect(repeated.tagName).toBe('SECTION')
    expect(repeated.className).toBe(wrapper.className)
    expect(seen).toBe(wrapper.className)
    target.remove()
  })

  it('declares its whole merged theme when it is inside portal content, under the providers of the tree', () => {
    const style = setup()
    const target = document.createElement('div')
    document.body.appendChild(target)
    render(
      <style.ThemeProvider theme={light}>
        <style.ThemeProvider theme={dark}>
          {createPortal(
            <style.ThemeProvider theme={{ palette: { text: '#ff0000' } }}>
              <i>portal</i>
            </style.ThemeProvider>,
            target
          )}
        </style.ThemeProvider>
      </style.ThemeProvider>
    )
    const inner = screen.getByText('portal').parentElement as HTMLElement
    expect(inner.parentElement).toBe(target)
    const full = inner.className.split(' ')[2]
    style.engine.css({
      color: style.engine.refs.palette.primary,
      fill: style.engine.refs.palette.text,
    })
    expect(style.ruleOf(full)).toBe(
      `.${full}{--t-palette-primary:#8888ff;--t-palette-text:#ff0000;}`
    )
    target.remove()
  })

  it('passes the wrapper above it on with isRoot', () => {
    const style = setup()
    let seen: string | undefined
    const Probe = () => {
      seen = style.useThemeClass()
      return null
    }
    const { container } = render(
      <style.ThemeProvider theme={light}>
        <style.ThemeProvider theme={dark}>
          <style.ThemeProvider theme={dark} isRoot>
            <Probe />
          </style.ThemeProvider>
        </style.ThemeProvider>
      </style.ThemeProvider>
    )
    expect(seen).toBe((container.firstElementChild as HTMLElement).className)
  })
})

describe('a function theme', () => {
  it('gets the theme above, or the base theme for the outermost provider', () => {
    const style = setup()
    const seen: unknown[] = []
    const Probe = () => {
      seen.push(style.useTheme())
      return null
    }
    render(
      <style.ThemeProvider theme={(outer) => ({ palette: { text: outer.palette.primary } })}>
        <Probe />
        <style.ThemeProvider theme={(outer) => ({ palette: { primary: outer.palette.text } })}>
          <Probe />
        </style.ThemeProvider>
      </style.ThemeProvider>
    )
    expect(seen[0]).toMatchObject({ palette: { primary: '#0000ff', text: '#0000ff' } })
    expect(seen[1]).toMatchObject({ palette: { primary: '#0000ff', text: '#0000ff' } })
  })

  it('gets an empty object where there is no base theme, and its result becomes the base', () => {
    const engine = createLazyEngine<typeof light>({
      prefix: 'f',
      cache: createCache({ prefix: 'f', sheet: createMemorySheet() }),
    })
    const style = bindEngine(engine)
    const seen: unknown[] = []
    render(
      <style.ThemeProvider
        theme={(outer) => {
          seen.push(outer)
          return light
        }}
      >
        x
      </style.ThemeProvider>
    )
    expect(seen[0]).toEqual({})
    expect(engine.baseTheme).toBe(light)
  })
})

describe('the helpers of a raw key', () => {
  it('survive a nested provider that sets the key', () => {
    const style = setup()
    let up: unknown
    const Probe = () => {
      up = (style.useTheme().breakpoints as unknown as { up: unknown }).up
      return null
    }
    render(
      <style.ThemeProvider theme={light}>
        <style.ThemeProvider theme={{ breakpoints: { values: { md: 600 } } }}>
          <Probe />
        </style.ThemeProvider>
      </style.ThemeProvider>
    )
    expect(up).toBe((light.breakpoints as unknown as { up: unknown }).up)
  })
})

describe('the default style', () => {
  it('exports the theme context before the engine exists, and ThemeScope and useThemeClass', () => {
    const style = createDefaultStyle()
    const { ThemeContext } = style
    style.configure({
      prefix: 'dd',
      cache: createCache({ prefix: 'dd', sheet: createMemorySheet() }),
    })
    const seen: unknown[] = []
    const Probe = () => {
      seen.push(style.useThemeClass())
      return null
    }
    const { container } = render(
      <style.ThemeProvider theme={light as never}>
        <style.ThemeProvider theme={dark as never}>
          <ThemeContext.Consumer>{(theme) => (seen.push(theme), null)}</ThemeContext.Consumer>
          <style.ThemeScope>
            <Probe />
          </style.ThemeScope>
        </style.ThemeProvider>
      </style.ThemeProvider>
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(seen).toEqual([{ ...light, ...dark }, wrapper.className])
    expect(wrapper.querySelectorAll('div')).toHaveLength(1)
  })
})

describe('the identity of the theme that useTheme returns', () => {
  it('is the same object across renders while the theme given and the theme above are', () => {
    const style = setup()
    const seen: unknown[] = []
    const Probe = ({ tick }: { tick: number }) => {
      seen.push(style.useTheme())
      return <i>{tick}</i>
    }
    const tree = (tick: number) => (
      <style.ThemeProvider theme={light}>
        <style.ThemeProvider theme={dark}>
          <Probe tick={tick} />
        </style.ThemeProvider>
      </style.ThemeProvider>
    )
    const { rerender } = render(tree(1))
    rerender(tree(2))
    rerender(tree(3))
    expect(seen).toHaveLength(3)
    expect(seen[1]).toBe(seen[0])
    expect(seen[2]).toBe(seen[0])
    // A branch that the theme given does not change is the one of the theme above.
    expect((seen[0] as typeof light).breakpoints).toBe(light.breakpoints)
  })

  it('is the theme given, for an outermost provider with no base theme, in every render', () => {
    const engine = createLazyEngine<typeof light>({
      prefix: 'i',
      cache: createCache({ prefix: 'i', sheet: createMemorySheet() }),
    })
    const style = bindEngine(engine)
    const seen: unknown[] = []
    const Probe = ({ tick }: { tick: number }) => {
      seen.push(style.useTheme())
      return <i>{tick}</i>
    }
    const tree = (tick: number) => (
      <style.ThemeProvider theme={light}>
        <Probe tick={tick} />
      </style.ThemeProvider>
    )
    const { rerender } = render(tree(1))
    rerender(tree(2))
    expect(seen).toEqual([light, light])
    expect(seen[0]).toBe(light)
    expect(seen[1]).toBe(light)
  })
})
