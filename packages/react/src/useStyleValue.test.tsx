import { act, render } from '@testing-library/react'
import { StrictMode, useEffect } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { expectTypeOf } from 'vitest'
import { add, createCache, createDomSheet, multiply, type LiveValue } from '@umber-style/core'
import { CacheProvider } from './CacheProvider'
import { createStyle } from './createStyle'
import type { StyleValueSetter } from './types'

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

/** The declarations of the variables in the element of the values of `prefix`, by name. */
function readDeclared(prefix: string, page: Document = document): Record<string, string> {
  const element = page.head.querySelector<HTMLStyleElement>(`style[data-style="${prefix}-values"]`)
  const declared: Record<string, string> = {}
  for (const outer of element?.sheet?.cssRules ?? []) {
    const { style } = (outer as CSSGroupingRule).cssRules[0] as CSSStyleRule
    declared[style[0]] = style.getPropertyValue(style[0])
  }
  return declared
}

/** A slider thumb whose left side reads a value; it records each render and hands out what it has. */
function createSlider(prefix: string) {
  const style = createStyle({}, { prefix })
  const Thumb = style.styled('div', { name: 'Thumb' })({ position: 'absolute' })
  const seen = {
    renders: 0,
    value: undefined as unknown as LiveValue,
    sets: [] as StyleValueSetter[],
  }
  function Slider() {
    const [left, setLeft] = style.useStyleValue(10, '%')
    seen.renders += 1
    seen.value = left
    seen.sets.push(setLeft)
    return <Thumb data-testid="thumb" style={{ left: `${left}`, top: multiply(left, 2) }} />
  }
  return { style, Slider, seen }
}

describe('useStyleValue', () => {
  it('gives a value and a setter, as useState does, typed so that the value is no number', () => {
    const { Slider, seen } = createSlider('sa')
    render(<Slider />)
    const [value, set] = [seen.value, seen.sets[0]]
    expectTypeOf(value.get()).toEqualTypeOf<number>()
    expectTypeOf(set).toEqualTypeOf<StyleValueSetter>()
    // @ts-expect-error A value is a reference to a variable: arithmetic on it is a type error.
    expect(value + 1).toMatch(/^var\(--sa-value-\w+, 10%\)1$/)
    expectTypeOf(add(value, 4)).toEqualTypeOf<string | number>()
    expect(value.get()).toBe(10)
    expect(String(value)).toMatch(/^var\(--sa-value-\w+, 10%\)$/)
  })

  it('declares the variable while the component is mounted, and changes it in place with no render', () => {
    const { Slider, seen } = createSlider('sb')
    const { getByTestId } = render(<Slider />)
    const className = getByTestId('thumb').className
    const name = String(seen.value).slice(4).split(',')[0]
    expect(readDeclared('sb')).toEqual({ [name]: '10%' })
    act(() => {
      for (let step = 1; step <= 300; step += 1) seen.sets[0](step / 10)
    })
    expect(readDeclared('sb')).toEqual({ [name]: '30%' })
    expect(seen.value.get()).toBe(30)
    expect(seen.renders).toBe(1)
    expect(getByTestId('thumb').className).toBe(className)
  })

  it('takes a function of the number before, and keeps one setter for the life of the component', () => {
    const { Slider, seen } = createSlider('sc')
    const { rerender } = render(<Slider />)
    act(() => seen.sets[0]((previous) => previous + 5))
    act(() => seen.sets[0]((previous) => previous * 2))
    rerender(<Slider />)
    expect(seen.value.get()).toBe(30)
    expect(Object.values(readDeclared('sc'))).toEqual(['30%'])
    expect(seen.sets[1]).toBe(seen.sets[0])
  })

  it('gives each component a variable of its own, on one shared prototype', () => {
    const style = createStyle({}, { prefix: 'sd' })
    const values: LiveValue[] = []
    function Probe({ initial }: { initial: number }) {
      const [value] = style.useStyleValue(initial)
      values.push(value)
      return null
    }
    render(
      <>
        <Probe initial={1} />
        <Probe initial={2} />
      </>
    )
    const [first, second] = values
    expect(String(first)).not.toBe(String(second))
    expect(first.get).toBe(second.get)
    expect(Object.values(readDeclared('sd'))).toEqual(['1', '2'])
  })

  it('removes its rule when the component unmounts, and a later set changes only the number', () => {
    const { Slider, seen } = createSlider('se')
    const { unmount } = render(<Slider />)
    unmount()
    expect(readDeclared('se')).toEqual({})
    seen.sets[0](40)
    expect(seen.value.get()).toBe(40)
    expect(readDeclared('se')).toEqual({})
  })

  it('declares one rule under strict mode, with the number set before the second mount', () => {
    const style = createStyle({}, { prefix: 'sf' })
    function Probe() {
      const [, setValue] = style.useStyleValue(0, 'px')
      useEffect(() => setValue(7), [setValue])
      return null
    }
    render(
      <StrictMode>
        <Probe />
      </StrictMode>
    )
    expect(Object.values(readDeclared('sf'))).toEqual(['7px'])
  })

  it('hydrates a server page with the same reference, and declares its rule once', () => {
    const { Slider, seen } = createSlider('sh')
    const container = document.createElement('div')
    container.innerHTML = renderToString(<Slider />)
    document.body.appendChild(container)
    const serverClass = (container.firstElementChild as HTMLElement).className
    const serverValue = String(seen.value)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let root: ReturnType<typeof hydrateRoot> | undefined
    act(() => {
      root = hydrateRoot(container, <Slider />)
    })
    expect(error).not.toHaveBeenCalled()
    expect(String(seen.value)).toBe(serverValue)
    expect((container.firstElementChild as HTMLElement).className).toBe(serverClass)
    expect(Object.values(readDeclared('sh'))).toEqual(['10%'])
    act(() => seen.sets[1](50))
    expect(Object.values(readDeclared('sh'))).toEqual(['50%'])
    act(() => root?.unmount())
    error.mockRestore()
  })

  it('names its variable after the prefix of a CacheProvider above, and declares it in the document of that cache', () => {
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const frame = iframe.contentDocument as Document
    const cache = createCache({ prefix: 'frame', sheet: createDomSheet('frame', frame.head) })
    const style = createStyle({}, { prefix: 'sg' })
    const values: LiveValue[] = []
    function Probe() {
      const [value] = style.useStyleValue(3)
      values.push(value)
      return null
    }
    render(
      <CacheProvider value={cache}>
        <Probe />
      </CacheProvider>
    )
    expect(String(values[0])).toMatch(/^var\(--frame-value-\w+, 3\)$/)
    expect(Object.values(readDeclared('frame', frame))).toEqual(['3'])
    expect(readDeclared('frame')).toEqual({})
  })
})
