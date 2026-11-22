import { act, render } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { useMediaQuery, type MediaQueryOptions } from './useMediaQuery'

/** The width of the stand-in window, and the listeners of every query list made for it. */
let width = 400
const listeners = new Set<() => void>()

/**
 * A stand-in for `matchMedia`, which jsdom does not have: it reads `(min-width: Npx)` against `width`.
 * It tells its listeners of every resize, also one that changes no answer, which the hook must ignore.
 */
function matchMedia(query: string) {
  const min = Number(/min-width:\s*(\d+)px/.exec(query)?.[1])
  return {
    media: query,
    get matches() {
      return width >= min
    },
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }
}

const resize = (next: number) =>
  act(() => {
    width = next
    for (const listener of listeners) listener()
  })

/** A component that renders, and records, the answer of `useMediaQuery(query, options)`. */
function createProbe(options?: MediaQueryOptions) {
  const answers: boolean[] = []
  const Probe = ({ query = '(min-width: 600px)' }: { query?: string }) => {
    const matches = useMediaQuery(query, options)
    answers.push(matches)
    return <p>{matches ? 'wide' : 'narrow'}</p>
  }
  return { Probe, answers }
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(matchMedia))
})

afterEach(() => {
  width = 400
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('useMediaQuery on the web', () => {
  it('answers as matchMedia does, and renders again only when its answer changes', () => {
    const { Probe, answers } = createProbe()
    const { container } = render(<Probe />)
    resize(500)
    resize(700)
    resize(900)
    expect(container.textContent).toBe('wide')
    resize(100)
    expect(answers).toEqual([false, true, false])
  })

  it('listens to the list of its query, and to the new one when the query changes', () => {
    const { Probe, answers } = createProbe()
    const { rerender, unmount } = render(<Probe />)
    expect(listeners.size).toBe(1)
    rerender(<Probe query="(min-width: 300px)" />)
    expect(listeners.size).toBe(1)
    expect(answers.at(-1)).toBe(true)
    unmount()
    expect(listeners.size).toBe(0)
  })

  it('is defaultMatches, else false, on the server', () => {
    const yes = createProbe({ defaultMatches: true })
    const no = createProbe()
    width = 0
    expect(renderToString(<yes.Probe />)).toBe('<p>wide</p>')
    expect(renderToString(<no.Probe />)).toBe('<p>narrow</p>')
  })

  it('hydrates the HTML of the server with no mismatch, then gives the answer of the browser', async () => {
    const { Probe, answers } = createProbe()
    const container = document.createElement('div')
    container.innerHTML = renderToString(<Probe />)
    document.body.append(container)
    width = 800
    const onRecoverableError = vi.fn()
    const error = vi.spyOn(console, 'error')
    await act(async () => {
      hydrateRoot(container, <Probe />, { onRecoverableError })
    })
    expect(onRecoverableError).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    expect(answers).toEqual([false, false, true])
    expect(container.innerHTML).toBe('<p>wide</p>')
  })
})
