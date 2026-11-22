import { type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { userEvent } from 'vitest/browser'
import { createStyle } from './createStyle'

const theme = { palette: { primary: '#0000ff', accent: '#ff0000' }, space: [0, 4, 8] }

let count = 0
const roots: Root[] = []

afterEach(() => {
  for (const root of roots.splice(0)) flushSync(() => root.unmount())
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

/** A real React render into the real document, with its own engine and style element. */
function setup() {
  const style = createStyle(theme, { prefix: `rb${++count}` })
  const render = (node: ReactNode) => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    roots.push(root)
    flushSync(() => root.render(node))
    return container
  }
  return { ...style, render }
}

const RED = 'rgb(255, 0, 0)'
const BLUE = 'rgb(0, 0, 255)'
const GREEN = 'rgb(0, 128, 0)'
const ORANGE = 'rgb(255, 165, 0)'
const color = (element: Element) => getComputedStyle(element).color
const only = (container: Element) => container.firstElementChild as HTMLElement

type Props = { tone?: string }

describe('overrides through the style prop, in a real browser', () => {
  it('beats the own plain property and the own :hover rule, also while the pointer is over it', async () => {
    const { styled, StyleSheet, render } = setup()
    const sheet = StyleSheet.create({ outside: { color: BLUE } })
    const Button = styled('button', { name: 'Button' })({
      color: RED,
      '&:hover': { color: ORANGE },
    })
    const element = only(render(<Button style={sheet.outside}>go</Button>))
    expect(color(element)).toBe(BLUE)
    await userEvent.hover(element)
    expect(element.matches(':hover')).toBe(true)
    expect(color(element)).toBe(BLUE)
  })

  it('merges a plain style object into one override class, with no style attribute', () => {
    const { styled, render } = setup()
    const Box = styled('div', { name: 'Box' })({ color: RED })
    const element = only(render(<Box style={{ color: BLUE }}>x</Box>))
    expect(color(element)).toBe(BLUE)
    expect(element.hasAttribute('style')).toBe(false)
  })
})

describe('the base class and the props class, in a real browser', () => {
  it('a property set by both: the props class wins', () => {
    const { styled, render } = setup()
    const Box = styled('div', { name: 'Box' })<Props>({ color: RED }, ({ tone }) => ({
      color: tone,
    }))
    const element = only(render(<Box tone={BLUE}>x</Box>))
    expect(element.className.split(' ').length).toBe(2)
    expect(color(element)).toBe(BLUE)
  })

  it('a base :hover against a plain props property: the plain one shows, the base :hover wins while hovered', async () => {
    const { styled, render } = setup()
    const Box = styled('div', { name: 'Box' })<Props>(
      { '&:hover': { color: ORANGE } },
      ({ tone }) => ({
        color: tone,
      })
    )
    const element = only(render(<Box tone={BLUE}>x</Box>))
    expect(color(element)).toBe(BLUE)
    await userEvent.hover(element)
    expect(color(element)).toBe(ORANGE)
  })

  it('both define :hover: the props class wins while hovered', async () => {
    const { styled, render } = setup()
    const Box = styled('div', { name: 'Box' })<Props>(
      { '&:hover': { color: ORANGE } },
      ({ tone }) => ({ '&:hover': { color: tone } })
    )
    const element = only(render(<Box tone={GREEN}>x</Box>))
    await userEvent.hover(element)
    expect(color(element)).toBe(GREEN)
  })

  it('a base @media against a plain props property: the props class wins at every width (a known difference from one merged class)', () => {
    const { styled, render } = setup()
    // The query always matches here, so the base rule would win if the at-rule were written after the plain one.
    const Box = styled('div', { name: 'Box' })<Props>(
      { '@media (min-width: 1px)': { color: GREEN } },
      ({ tone }) => ({ color: tone })
    )
    const element = only(render(<Box tone={BLUE}>x</Box>))
    expect(matchMedia('(min-width: 1px)').matches).toBe(true)
    expect(color(element)).toBe(BLUE)
    // The documented remedy: the plain property of the props part written in the media rule too.
    const Fixed = styled('div', { name: 'Fixed' })<Props>(
      { '@media (min-width: 1px)': { color: GREEN } },
      ({ tone }) => ({ color: tone, '@media (min-width: 1px)': { color: GREEN } })
    )
    expect(color(only(render(<Fixed tone={BLUE}>x</Fixed>)))).toBe(GREEN)
  })
})

describe('nested providers in a real browser', () => {
  it('display: contents wrappers do not change how a flex parent lays out its children', () => {
    const { styled, ThemeProvider, render } = setup()
    const Row = styled('div', { name: 'Row' })({ display: 'flex', gap: 10, width: 400 })
    const Item = styled('div', { name: 'Item' })({ width: 50, height: 20 })
    const direct = only(
      render(
        <Row>
          <Item />
          <Item />
          <Item />
        </Row>
      )
    )
    // The providers are nested under an outermost one, which renders no element: each renders a wrapper.
    const wrapped = only(
      render(
        <ThemeProvider theme={theme}>
          <Row>
            <ThemeProvider theme={{ palette: { primary: '#008000' } }}>
              <Item />
            </ThemeProvider>
            <ThemeProvider theme={{ palette: { primary: '#ff0000' } }}>
              <Item />
            </ThemeProvider>
            <ThemeProvider theme={{ palette: { primary: '#0000ff' } }}>
              <Item />
            </ThemeProvider>
          </Row>
        </ThemeProvider>
      )
    )
    expect(getComputedStyle(wrapped.firstElementChild!).display).toBe('contents')
    const boxes = (parent: Element) =>
      [...parent.querySelectorAll('[class*="item-root"]')].map((element) => {
        const rect = element.getBoundingClientRect()
        return [rect.left - parent.getBoundingClientRect().left, rect.width, rect.height]
      })
    expect(boxes(wrapped)).toEqual(boxes(direct))
    expect(boxes(direct)).toEqual([
      [0, 50, 20],
      [60, 50, 20],
      [120, 50, 20],
    ])
  })
})
