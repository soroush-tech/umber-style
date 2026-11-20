import { act, render } from '@testing-library/react'
import { createElement } from 'react'
import { createCache } from '@umber-style/core'
import { GlobalRelease } from './GlobalRelease'

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

/** The rules that the style sheets of `elements` hold, as the browser parsed them. */
const readRules = (elements: Iterable<HTMLStyleElement>) =>
  [...elements].flatMap((element) =>
    [...(element.sheet as CSSStyleSheet).cssRules].map((rule) => rule.cssText.replace(/\s+/g, ''))
  )

/** The rules of every style sheet of the page. */
const sheetRules = () => readRules(document.querySelectorAll('style'))

/**
 * What the browser receives of a server component's `Global`, as React renders it from the payload: the
 * `<style href precedence>` element of the set, which React puts in the head and keeps, then the client
 * component with the set as data. A cache of the prefix serves the page, as the client build makes one.
 */
function setup(prefix: string) {
  const cache = createCache({ prefix, hasDevChecks: false, hasLayers: false })
  const { id, rules } = cache.compileGlobal({ nav: { color: 'red' } })
  const sets = JSON.stringify([[id, rules]])
  const Payload = () => (
    <>
      {createElement('style', { href: id, precedence: prefix }, rules.join(''))}
      <GlobalRelease prefix={prefix} sets={sets} />
    </>
  )
  /** The rules that the cache wrote into its own style element. */
  const ownRules = () =>
    readRules(document.querySelectorAll<HTMLStyleElement>(`style[data-style="${prefix}"]`))
  return { cache, id, sets, Payload, ownRules }
}

describe('GlobalRelease, the browser part of the Global of a server component', () => {
  it('lets the cache take the rule over from the element React put in the head, and deletes it on unmount', () => {
    const { id, Payload, ownRules } = setup('ra')
    const { unmount } = render(<Payload />)
    const element = document.querySelector(`style[data-href="${id}"]`) as HTMLStyleElement
    expect(element.parentElement).toBe(document.head)
    expect(sheetRules()).toEqual(['nav{color:red;}'])
    expect(ownRules()).toEqual([])
    unmount()
    expect(sheetRules()).toEqual([])
    // React keeps the element, and its text: nothing parses it again.
    expect(element.isConnected).toBe(true)
    expect(element.textContent).toBe('nav{color:red;}')
  })

  it('has the cache write the rule when it mounts again, the element no longer having it, and remove it after', () => {
    const { Payload, ownRules } = setup('rb')
    render(<Payload />).unmount()
    const { unmount } = render(<Payload />)
    expect(ownRules()).toEqual(['nav{color:red;}'])
    expect(sheetRules()).toEqual(['nav{color:red;}'])
    unmount()
    expect(sheetRules()).toEqual([])
  })

  it('writes nothing again for the same sets in a new payload', () => {
    const { cache, sets, ownRules } = setup('rc')
    const insert = vi.spyOn(cache, 'insertGlobal')
    const { rerender } = render(<GlobalRelease prefix="rc" sets={sets} />)
    rerender(<GlobalRelease prefix="rc" sets={`${sets}`} />)
    expect(insert).toHaveBeenCalledTimes(1)
    expect(ownRules()).toEqual(['nav{color:red;}'])
  })

  it('does nothing where the page has no cache of the prefix', () => {
    const rule = 'nav{color:red;}'
    const { unmount } = render(
      <>
        {createElement('style', { href: 'rd-global-x', precedence: 'rd' }, rule)}
        <GlobalRelease prefix="rd" sets={JSON.stringify([['rd-global-x', [rule]]])} />
      </>
    )
    act(() => unmount())
    expect(sheetRules()).toEqual([rule])
  })
})
