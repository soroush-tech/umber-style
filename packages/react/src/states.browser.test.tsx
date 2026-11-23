import { type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { at, state } from '@umber-style/core'
import { commands, userEvent } from 'vitest/browser'
import { createStyle } from './createStyle'

declare module 'vitest/browser' {
  interface BrowserCommands {
    /** Moves the pointer over the element with this test id and holds its button down. */
    holdPointer(testId: string): Promise<void>
    /** Lets the button of the pointer go. */
    releasePointer(): Promise<void>
  }
}

const theme = { palette: { primary: '#0000ff' } }

let count = 0
const roots: Root[] = []

afterEach(async () => {
  await commands.releasePointer()
  for (const root of roots.splice(0)) flushSync(() => root.unmount())
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

/** A real React render into the real document, with its own engine and style element. */
function setup() {
  const style = createStyle(theme, { prefix: `sb${++count}` })
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

const opacity = (element: Element) => getComputedStyle(element).opacity
const outline = (element: Element) => getComputedStyle(element).outlineStyle

/** A button whose looks come from the four state keys only. */
function createButton() {
  const { styled, render } = setup()
  const Button = styled('button', { name: 'Button' })({
    opacity: 1,
    outlineStyle: 'none',
    ...at(state('hovered'), { opacity: 0.9 }),
    ...at(state('pressed'), { opacity: 0.7 }),
    ...at(state('focused'), { outlineStyle: 'solid' }),
    ...at(state('disabled'), { opacity: 0.4 }),
  })
  return { Button, render }
}

describe('the state keys in a real browser', () => {
  it('apply hovered while the pointer is over the element', async () => {
    const { Button, render } = createButton()
    const element = render(<Button data-testid="hover">go</Button>).firstElementChild as Element
    expect(opacity(element)).toBe('1')
    await userEvent.hover(element)
    expect(opacity(element)).toBe('0.9')
    await userEvent.unhover(element)
    expect(opacity(element)).toBe('1')
  })

  it('apply pressed while the pointer is held down on it, and not once it is let go', async () => {
    const { Button, render } = createButton()
    const element = render(<Button data-testid="press">go</Button>).firstElementChild as Element
    await commands.holdPointer('press')
    expect(element.matches(':active')).toBe(true)
    expect(opacity(element)).toBe('0.7')
    await commands.releasePointer()
    expect(opacity(element)).toBe('0.9')
  })

  it('apply focused for keyboard focus, and not for the focus a click gives', async () => {
    const { Button, render } = createButton()
    const container = render(
      <>
        <button type="button">before</button>
        <Button data-testid="focus">go</Button>
      </>
    )
    const [before, element] = [...container.children] as HTMLElement[]
    await userEvent.click(element)
    expect(document.activeElement).toBe(element)
    expect(outline(element)).toBe('none')
    await userEvent.click(before)
    await userEvent.tab()
    expect(document.activeElement).toBe(element)
    expect(element.matches(':focus-visible')).toBe(true)
    expect(outline(element)).toBe('solid')
  })

  it('apply disabled for the attribute and for aria-disabled, over hovered', async () => {
    const { Button, render } = createButton()
    const container = render(
      <>
        <Button disabled>off</Button>
        <Button aria-disabled="true">marked</Button>
        <Button aria-disabled="false">on</Button>
      </>
    )
    const [off, marked, on] = [...container.children]
    expect([opacity(off), opacity(marked), opacity(on)]).toEqual(['0.4', '0.4', '1'])
    await userEvent.hover(marked)
    expect(opacity(marked)).toBe('0.4')
  })
})
