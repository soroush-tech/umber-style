import { act, render } from '@testing-library/react'
import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { createCache, createMemorySheet, createStyleTag, type Sheet } from '@umber-style/core'
import { createStyle } from './createStyle'

const theme = { palette: { primary: '#0000ff' } }

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

function setup(sheet: Sheet = createMemorySheet()) {
  const style = createStyle(theme, {
    prefix: 'h',
    cache: createCache({ prefix: 'h', sheet, hasDevChecks: false }),
  })
  const Bar = style.styled('div', { name: 'Bar' })({ height: 4 })
  /** The rules in the sheet that declare `text`. */
  const rulesWith = (text: string) => sheet.rules.filter((rule) => rule.includes(text))
  return { ...style, sheet, Bar, rulesWith }
}

/** Runs the delay before a removal. */
const wait = () => act(() => vi.runAllTimers())

const classOf = (container: Element) => (container.firstElementChild as HTMLElement).className

describe('a plain object in the style of a styled component', () => {
  it('leaves one class of a hundred values that one element took', () => {
    const { Bar, rulesWith } = setup()
    const { container, rerender } = render(<Bar style={{ width: 0 }} />)
    const element = container.firstElementChild
    for (let width = 1; width < 100; width++) {
      rerender(<Bar style={{ width }} />)
      if (width % 10 === 0) wait()
    }
    wait()
    expect(rulesWith('width:')).toEqual([
      `@layer h-overrides{.${classOf(container).split(' ')[1]}{width:99px;}}`,
    ])
    expect(container.firstElementChild).toBe(element)
    expect(element?.hasAttribute('style')).toBe(false)
  })

  it('is one class for two elements, removed when the last one changes or unmounts', () => {
    const { Bar, rulesWith } = setup()
    const Pair = ({ first, second }: { first: number; second: number }) => (
      <>
        <Bar style={{ width: first }} />
        <Bar style={{ width: second }} />
      </>
    )
    const { container, rerender, unmount } = render(<Pair first={1} second={1} />)
    const [one, two] = [...container.children]
    expect(one.className).toBe(two.className)
    rerender(<Pair first={2} second={1} />)
    wait()
    expect(rulesWith('width:1px')).toHaveLength(1)
    rerender(<Pair first={2} second={2} />)
    wait()
    expect(rulesWith('width:1px')).toEqual([])
    expect(rulesWith('width:2px')).toHaveLength(1)
    unmount()
    expect(rulesWith('width:2px')).toHaveLength(1)
    wait()
    expect(rulesWith('width:')).toEqual([])
  })

  it('keeps a value that goes and comes straight back', () => {
    const { Bar, rulesWith } = setup()
    const { rerender } = render(<Bar style={{ width: 1 }} />)
    rerender(<Bar style={{ width: 2 }} />)
    rerender(<Bar style={{ width: 1 }} />)
    wait()
    expect(rulesWith('width:')).toEqual([expect.stringContaining('width:1px')])
  })

  it('is let go when the style no longer has an object, and the element stays', () => {
    const { Bar, rulesWith } = setup()
    const { container, rerender } = render(<Bar style={{ width: 1 }} />)
    const element = container.firstElementChild
    rerender(<Bar />)
    wait()
    expect(rulesWith('width:')).toEqual([])
    expect(container.firstElementChild).toBe(element)
    rerender(<Bar style={{ width: 3 }} />)
    expect(container.firstElementChild).toBe(element)
    expect(rulesWith('width:3px')).toHaveLength(1)
  })

  it('merges with an entry into one class that goes, while the entry keeps its own', () => {
    const { Bar, StyleSheet, rulesWith } = setup()
    const sheet = StyleSheet.create({ red: { color: 'red' } })
    const { unmount: unmountEntry } = render(<Bar style={sheet.red} />)
    const { container, unmount } = render(<Bar style={[sheet.red, { width: 5 }]} />)
    expect(classOf(container).split(' ')).toHaveLength(2)
    unmount()
    unmountEntry()
    wait()
    expect(rulesWith('width:')).toEqual([])
    expect(rulesWith('color:red')).toEqual([
      expect.stringMatching(/^@layer h-overrides\{\.h-\w+\{color:red;\}\}$/),
    ])
  })

  it('counts right in strict mode', () => {
    const { Bar, rulesWith } = setup()
    const { rerender, unmount } = render(
      <StrictMode>
        <Bar style={{ width: 1 }} />
      </StrictMode>
    )
    wait()
    expect(rulesWith('width:1px')).toHaveLength(1)
    rerender(
      <StrictMode>
        <Bar style={{ width: 2 }} />
      </StrictMode>
    )
    wait()
    expect(rulesWith('width:')).toEqual([expect.stringContaining('width:2px')])
    unmount()
    wait()
    expect(rulesWith('width:')).toEqual([])
  })

  it('stays with a sheet that cannot remove', () => {
    const rules: string[] = []
    const { Bar } = setup({ rules, insert: (rule) => void rules.push(rule) })
    render(<Bar style={{ width: 1 }} />).unmount()
    wait()
    expect(rules.filter((rule) => rule.includes('width:1px'))).toHaveLength(1)
  })

  it('is taken over from a server render, and removed from the page when the value changes', () => {
    const server = setup()
    const html = renderToString(<server.Bar style={{ width: 5 }} />)
    document.head.innerHTML = createStyleTag(server.cache)
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    const pageRules = () =>
      [
        ...(
          (document.querySelector('style[data-style="h"]') as HTMLStyleElement)
            .sheet as CSSStyleSheet
        ).cssRules,
      ]
        .map((rule) => rule.cssText)
        .filter((text) => text.includes('width'))

    const { Bar, rulesWith } = setup()
    let root: ReturnType<typeof hydrateRoot> | undefined
    act(() => {
      root = hydrateRoot(container, <Bar style={{ width: 5 }} />)
    })
    wait()
    expect(rulesWith('width:')).toEqual([])
    expect(pageRules()).toHaveLength(1)
    act(() => root?.render(<Bar style={{ width: 6 }} />))
    wait()
    expect(pageRules()).toEqual([])
    expect(rulesWith('width:')).toEqual([expect.stringContaining('width:6px')])
    act(() => root?.unmount())
  })
})
