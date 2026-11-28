import { act, render, screen } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { at, createCache, createMemorySheet, isSheetEntry } from '@umber-style/core'
import { CacheProvider } from './CacheProvider'
import { createStyle } from './createStyle'
import type { SheetStyleProp } from './types'

const theme = { palette: { primary: '#0000ff' }, space: [0, 4, 8], breakpoints: ['900px'] }

function setup() {
  const sheet = createMemorySheet()
  const style = createStyle(theme, { prefix: 'b', cache: createCache({ prefix: 'b', sheet }) })
  return { ...style, rules: sheet.rules }
}

/** A sheet of the theme of `style`, and a static and a dynamic styled component. */
function build(style: ReturnType<typeof setup>) {
  const sheet = style.StyleSheet.create((view) => ({
    box: {
      color: view.palette.primary,
      ...at(`@media (width >= ${view.breakpoints[0]})`, { margin: 1 }),
    },
    raised: { opacity: 0.9 },
  }))
  const Static = style.styled('div', { name: 'Static' })({ display: 'block' })
  const Dynamic = style.styled('div', { name: 'Dynamic' })(({ theme: view }) => ({
    padding: view.space[1],
  }))
  return { sheet, Static, Dynamic }
}

/** What a server component passing `value` to a client component leaves of it: its own keys, as data. */
const cross = (value: unknown) => JSON.parse(JSON.stringify(value)) as object

const classOf = (testId: string) => screen.getByTestId(testId).className

describe('style={sheet.key} of a sheet made from a function of the theme', () => {
  it('is a handle, not an entry, made on first read and kept', () => {
    const { sheet } = build(setup())
    expect(isSheetEntry(sheet.box)).toBe(false)
    expect(sheet.box).toBe(sheet.box)
    expect(typeof (sheet as unknown as { resolve: unknown }).resolve).toBe('function')
    expect(Object.keys(sheet)).toEqual(['resolve'])
  })

  it('gives the class and the rules of useStyle(sheet).key, under nested providers, alone and in lists', () => {
    const page = (style: ReturnType<typeof setup>, kind: 'handle' | 'hook') => {
      const { sheet, Static, Dynamic } = build(style)
      const Probe = ({ id }: { id: string }) => {
        const styles = style.useStyle(sheet)
        const entries = kind === 'handle' ? sheet : styles
        return (
          <>
            <Static data-testid={`${kind}-${id}-s`} style={entries.box} />
            <Dynamic data-testid={`${kind}-${id}-d`} style={entries.box} />
            <Static
              data-testid={`${kind}-${id}-l`}
              style={[entries.box, false, null, undefined, entries.raised, { width: 1 }]}
            />
          </>
        )
      }
      return (
        <style.ThemeProvider theme={theme}>
          <Probe id="outer" />
          <style.ThemeProvider theme={{ breakpoints: ['500px'] }}>
            <Probe id="nested" />
          </style.ThemeProvider>
        </style.ThemeProvider>
      )
    }
    const withHandles = setup()
    const withHook = setup()
    render(
      <>
        {page(withHandles, 'handle')}
        {page(withHook, 'hook')}
      </>
    )
    for (const id of ['outer', 'nested']) {
      for (const kind of ['s', 'd', 'l']) {
        expect(classOf(`handle-${id}-${kind}`)).toBe(classOf(`hook-${id}-${kind}`))
      }
    }
    expect(classOf('handle-outer-s')).not.toBe(classOf('handle-nested-s'))
    expect(withHandles.rules).toEqual(withHook.rules)
    expect(withHandles.rules.some((rule) => rule.includes('500px'))).toBe(true)
  })

  it('is the entry of useStyle under a cache provider, written in that cache', () => {
    const style = setup()
    const { sheet, Static } = build(style)
    const other = createMemorySheet()
    const Probe = () => {
      const styles = style.useStyle(sheet)
      return (
        <>
          <Static data-testid="handle" style={sheet.box} />
          <Static data-testid="hook" style={styles.box} />
        </>
      )
    }
    render(
      <CacheProvider value={createCache({ prefix: 'c', sheet: other })}>
        <style.ThemeProvider theme={theme}>
          <Probe />
        </style.ThemeProvider>
      </CacheProvider>
    )
    expect(classOf('handle')).toBe(classOf('hook'))
    expect(classOf('handle')).toMatch(/\bc-/)
  })

  it('keeps the hooks of a static component in order when style switches between a handle and none', () => {
    const style = setup()
    const { sheet, Static } = build(style)
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let flip: () => void = () => undefined
    const Toggle = () => {
      const [isOn, setOn] = useState(false)
      flip = () => setOn((value) => !value)
      return <Static data-testid="t" style={isOn ? sheet.box : undefined} />
    }
    render(
      <style.ThemeProvider theme={theme}>
        <Toggle />
      </style.ThemeProvider>
    )
    const before = classOf('t')
    act(() => flip())
    const after = classOf('t')
    act(() => flip())
    expect(after).not.toBe(before)
    expect(classOf('t')).toBe(before)
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
  })

  it('is a TypeError where no theme is known: apply, css(), the styles of styled, a plain element', () => {
    const style = setup()
    const { sheet } = build(style)
    expect(() => style.apply(sheet.box as never)).toThrow(/^apply\(\): an entry of a sheet/)
    expect(() => style.css(sheet.box as never)).toThrow(/^css\(\): /)
    expect(() => style.styled('div')(sheet.box as never)).toThrow(/^styled\(\): /)
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<div style={sheet.box as never} />)).toThrow(/^A plain element: /)
    expect(() => render(<div className={sheet.box as never} />)).toThrow(/^Its text/)
    errors.mockRestore()
  })
})

describe('a style passed from a server component, which cannot cross', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('is unstyled, and a development warning says what to do instead', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const server = setup()
    const entry = server.StyleSheet.create({ card: { color: 'red' } }).card
    const style = setup()
    const Box = style.styled('div', { name: 'Box' })({ display: 'block' })
    render(
      <>
        <Box data-testid="entry" style={cross(entry) as never} />
        <Box data-testid="handle" style={{ '--umber-themed-1.raised': null } as never} />
      </>
    )
    const [, given] = classOf('entry').split(' ')
    expect(given, 'the class name passes through').toBe(entry.className)
    expect(style.rules.some((rule) => rule.includes(`.${given}{`))).toBe(false)
    expect(classOf('handle').split(' ')).toHaveLength(1)
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      `[b] A style was passed from a server component to a client component (--umber-entry-${given}), and its CSS cannot cross: import the sheet in the client component, and pass a plain value such as a string to choose the style.`,
      expect.stringMatching(
        /^\[b\] A style was passed from a server component to a client component \(--umber-themed-[\d.]+raised\)/
      ),
    ])
  })
})

describe('the slot pattern', () => {
  it('gives each part its entry, from handles and entries, within the client', () => {
    const style = setup()
    const sheet = style.StyleSheet.create((view) => ({
      root: { padding: view.space[2] },
      avatar: { color: view.palette.primary },
    }))
    const Root = style.styled('section', { name: 'Card' })({ display: 'grid' })
    const Avatar = style.styled('img', { name: 'Card', slot: 'avatar' })({ borderRadius: 4 })
    interface CardProps {
      styleProps?: { root?: SheetStyleProp; avatar?: SheetStyleProp }
      id: string
      children?: ReactNode
    }
    const Card = ({ styleProps = {}, id }: CardProps) => (
      <Root data-testid={`${id}-root`} style={styleProps.root}>
        <Avatar data-testid={`${id}-avatar`} style={styleProps.avatar} alt="" />
      </Root>
    )
    const Page = () => {
      const styles = style.useStyle(sheet)
      return (
        <>
          <Card id="handle" styleProps={{ root: sheet.root, avatar: sheet.avatar }} />
          <Card id="hook" styleProps={{ root: styles.root, avatar: styles.avatar }} />
        </>
      )
    }
    render(
      <style.ThemeProvider theme={theme}>
        <Page />
      </style.ThemeProvider>
    )
    for (const part of ['root', 'avatar']) {
      expect(classOf(`handle-${part}`)).toBe(classOf(`hook-${part}`))
    }
  })
})
