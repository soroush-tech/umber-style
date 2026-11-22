import { type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { createStyle } from './createStyle'

const theme = { palette: { text: '#ff0000', other: '#0000ff' }, breakpoints: { md: 1 } }

let count = 0
const roots: Root[] = []

afterEach(() => {
  for (const root of roots.splice(0)) flushSync(() => root.unmount())
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

/** A real React render into the real document, with its own engine and style element; the theme class is on `<html>`. */
function setup() {
  const style = createStyle(theme, { prefix: `gb${++count}` })
  document.documentElement.className = style.themeClass(theme)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  const render = (node: ReactNode) => flushSync(() => root.render(node))
  const unmount = () => {
    roots.splice(roots.indexOf(root), 1)
    flushSync(() => root.unmount())
  }
  return { ...style, container, render, unmount }
}

const RED = 'rgb(255, 0, 0)'
const BLUE = 'rgb(0, 0, 255)'
const BLACK = 'rgb(0, 0, 0)'
const bodyColor = () => getComputedStyle(document.body).color

describe('Global in a real browser', () => {
  it('applies a rule for body, with a token, and removes it when it unmounts', () => {
    const { Global, globalStyles, render, unmount } = setup()
    const base = globalStyles((view) => ({ body: { color: view.palette.text } }))
    render(<Global styles={base} />)
    expect(bodyColor()).toBe(RED)
    unmount()
    expect(bodyColor()).toBe(BLACK)
  })

  it('replaces its rule when its styles change, and loses to a component', () => {
    const { Global, styled, render } = setup()
    const Text = styled('p', { name: 'Text' })(({ theme: view }) => ({ color: view.palette.other }))
    render(<Global styles={{ body: { color: 'green' } }} />)
    render(
      <>
        <Global
          styles={(view: typeof theme) => ({
            body: { color: view.palette.text },
            p: { color: 'green' },
          })}
        />
        <Text>text</Text>
      </>
    )
    expect(bodyColor()).toBe(RED)
    expect(getComputedStyle(document.querySelector('p') as Element).color).toBe(BLUE)
  })
})

describe('Global over a page that a server rendered', () => {
  it('takes over the rule that the server sent, writes it no second time, and removes it when it unmounts', () => {
    const prefix = `gb${count + 1}`
    // What React hoists from the server render of the client build: the element of the set.
    const sent = document.createElement('style')
    sent.dataset.precedence = prefix
    sent.textContent = `@layer ${prefix}-theme,${prefix}-global,${prefix}-components,${prefix}-overrides;@layer ${prefix}-global{body{color:blue;}}`
    document.head.appendChild(sent)
    const { Global, cache, render, unmount } = setup()
    expect(cache.prefix).toBe(prefix)
    expect(bodyColor()).toBe(BLUE)
    render(<Global styles={{ body: { color: 'blue' } }} />)
    expect(cache.extract().css).not.toContain('body')
    unmount()
    expect(bodyColor()).toBe(BLACK)
    expect(sent.sheet?.cssRules).toHaveLength(1)
  })
})

describe('an animated styled component in a real browser', () => {
  it('runs the registered animation that its shorthand names', () => {
    const { styled, keyframes, render, container } = setup()
    const pulse = keyframes(
      (view) => ({ from: { color: view.palette.text }, to: { color: view.palette.other } }),
      { label: 'pulse' }
    )
    const Skeleton = styled('div', { name: 'Skeleton' })({
      animation: `${pulse} 1000ms cubic-bezier(0.4, 0, 0.6, 1) 100ms infinite`,
    })
    render(<Skeleton>loading</Skeleton>)
    const element = container.firstElementChild as HTMLElement
    const animations = element.getAnimations()
    expect(animations).toHaveLength(1)
    expect((animations[0] as CSSAnimation).animationName).toBe(pulse)
    expect(animations[0].playState).toBe('running')
  })
})
