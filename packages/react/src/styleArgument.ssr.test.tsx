// @vitest-environment node
import { renderToString } from 'react-dom/server'
import { createCache, createEngine, createMemorySheet, globalStyles } from '@umber-style/core'
import { bindEngine } from './createStyle'

const theme = { palette: { primary: '#0000ff', text: '#111111' }, space: [0, 4, 8] }
type PageTheme = typeof theme

/** A style over an engine with the development checks on or off. */
function setup(prefix: string, hasDevChecks: boolean) {
  const engine = createEngine(theme, {
    prefix,
    hasDevChecks,
    cache: createCache({ prefix, sheet: createMemorySheet() }),
  })
  return bindEngine(engine)
}

describe('the argument of the style functions of an element in a server render', () => {
  it('is one object for the functions of an element, and another for each element and each render', () => {
    for (const hasDevChecks of [false, true]) {
      const style = setup('sa', hasDevChecks)
      const seen: object[][] = []
      const Box = style.styled('div', { name: 'Box' })<{ tone: string }>(
        (argument) => {
          seen.push([argument])
          return { color: argument.tone }
        },
        (argument) => {
          seen.at(-1)?.push(argument)
          return { padding: argument.theme.space[1] }
        }
      )
      const page = (
        <>
          <Box tone="red" />
          <Box tone="blue" />
        </>
      )
      seen.length = 0
      const first = renderToString(page)
      const second = renderToString(page)
      expect(second).toBe(first)
      // The first render plans the base with an argument of its own, and calls the first function there.
      const renders = seen.filter((pair) => pair.length === 2)
      expect(renders).toHaveLength(4)
      for (const [one, other] of renders) expect(one).toBe(other)
      expect(new Set(renders.map(([one]) => one)).size).toBe(4)
    }
  })

  it('in development, throws when a style function changes it, naming the component, and a copy is fine (docs/writing-styles.md)', () => {
    const style = setup('umber', true)
    const Box = style.styled('div', { name: 'Box' })<{ tone?: string }>((argument) => {
      ;(argument as { tone?: string }).tone ??= 'red'
      return { color: argument.tone }
    })
    expect(() => renderToString(<Box />)).toThrow(
      new TypeError(
        '[umber] A style function of "box-root" threw a TypeError of a write into a frozen object: Cannot define property tone, object is not extensible. In development the argument of a style function is frozen: it is one object, the props with the theme, shared by the style functions of the element in a render. Copy the argument before changing it: const own = { ...props }.'
      )
    )
    const toneStyle = (props: { tone?: string }) => {
      const own = { ...props, tone: props.tone ?? 'plain' }
      return { color: own.tone === 'plain' ? 'inherit' : own.tone }
    }
    const Copier = style.styled('div', { name: 'Box' })<{ tone?: string }>(toneStyle)
    expect(renderToString(<Copier />)).toMatch(/^<style/)
  })

  it('in production, takes the change, and the page is that of a function that copies it', () => {
    const style = setup('sc', false)
    const Writer = style.styled('div', { name: 'Box' })<{ tone?: string }>(
      (argument) => {
        ;(argument as { tone?: string }).tone ??= 'red'
        return null
      },
      (argument) => ({ color: argument.tone })
    )
    const Copier = style.styled('div', { name: 'Box' })<{ tone?: string }>(
      () => null,
      (argument) => ({ color: { ...argument, tone: argument.tone ?? 'red' }.tone })
    )
    expect(renderToString(<Writer />)).toBe(renderToString(<Copier />))
  })
})

describe('the theme that the functions of a server render get', () => {
  it('in development, throws on a write from a provider function, a style function and Global, naming the path', () => {
    const style = setup('umber', true)
    const provided = (
      <style.ThemeProvider
        theme={(outer: PageTheme) => {
          outer.palette.text = '#000000'
          return {}
        }}
      >
        <i />
      </style.ThemeProvider>
    )
    expect(() => renderToString(provided)).toThrow(
      '[umber] theme.palette.text is set by a function of "ThemeProvider".'
    )
    const Card = style.styled('div', { name: 'Card' })(({ theme: view }) => {
      view.space.push(16)
      return null
    })
    expect(() => renderToString(<Card />)).toThrow(
      new TypeError(
        '[umber] theme.space.3 is set by a function of "card-root". The theme is one object, shared by every render and every request, so a change to it reaches all of them: never change it. Build a new object instead, such as [...theme.space].'
      )
    )
    const global = globalStyles((view: PageTheme) => {
      delete (view as Partial<PageTheme>).space
      return {}
    })
    expect(() => renderToString(<style.Global styles={global} />)).toThrow(
      '[umber] theme.space is deleted by a function of "Global".'
    )
    expect(theme).toEqual({ palette: { primary: '#0000ff', text: '#111111' }, space: [0, 4, 8] })
  })

  it('in production, gives a provider function the theme above itself', () => {
    const style = setup('se', false)
    let given: unknown
    renderToString(
      <style.ThemeProvider
        theme={(outer: PageTheme) => {
          given = outer
          return {}
        }}
      >
        <i />
      </style.ThemeProvider>
    )
    expect(given).toBe(theme)
  })
})
