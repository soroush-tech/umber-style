import { act, render } from '@testing-library/react'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { platform } from '../vitest.react-native'
import { createDefaultStyle } from './defaultStyle'
import { createStyle } from './createStyle'
import { useMediaQuery } from './index'
import { readWindowState, subscribeToWindow } from './windowState'

const resize = (width: number, height = 800) => act(() => platform.resize(width, height))

afterEach(() => {
  platform.resize(400, 800)
  vi.restoreAllMocks()
})

/** A component that records each answer of `useMediaQuery(query)`. */
function createProbe(query: string, options?: { defaultMatches?: boolean }, remBase?: number) {
  const { configure, useMediaQuery } = createDefaultStyle()
  if (remBase !== undefined) configure({ remBase })
  const answers: boolean[] = []
  const Probe = () => {
    answers.push(useMediaQuery(query, options))
    return null
  }
  return { Probe, answers }
}

describe('useMediaQuery on React Native', () => {
  it('answers as the style does, and renders again only when its answer changes', () => {
    const { styled } = createStyle({})
    const styles: unknown[] = []
    const View = (props: { style?: unknown }) => {
      styles.push(props.style)
      return null
    }
    const query: string = '@media (min-width: 600px)'
    const Card = styled(View)({ padding: 1, [query]: { padding: 2 } })
    const { Probe, answers } = createProbe('(min-width: 600px)')
    render(
      <>
        <Card />
        <Probe />
      </>
    )
    resize(500)
    resize(700)
    resize(900)
    resize(100)
    expect(answers).toEqual([false, true, false])
    expect(styles).toEqual([[{ padding: 1 }], [{ padding: 2 }], [{ padding: 1 }]])
  })

  it('takes the query with or without @media, and a rem length as the remBase of configure', () => {
    const { Probe, answers } = createProbe('@media (min-width: 40rem)', undefined, 10)
    render(<Probe />)
    resize(400)
    expect(answers).toEqual([true])
    const other = createProbe('(min-width: 40rem)')
    render(<other.Probe />)
    expect(other.answers).toEqual([false])
  })

  it('is false for a query it cannot evaluate, with a warning, and subscribes to nothing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { Probe, answers } = createProbe('(hover: hover)')
    render(<Probe />)
    expect(answers).toEqual([false])
    expect(platform.countListeners()).toBe(0)
    expect(warn).toHaveBeenCalledWith(
      '@umber-style/react-native: useMediaQuery("(hover: hover)") is false: React Native does not evaluate the media feature "hover".'
    )
  })

  it('gives defaultMatches, else false, in a render to a string', () => {
    const yes = createProbe('(min-width: 1px)', { defaultMatches: true })
    const no = createProbe('(min-width: 1px)')
    renderToString(<yes.Probe />)
    renderToString(<no.Probe />)
    expect(yes.answers).toEqual([true])
    expect(no.answers).toEqual([false])
  })
})

describe('the example of the React Native page', () => {
  it('lays the row out and names the button for the width of the window', () => {
    const recorded: { name: string; props: Record<string, unknown> }[] = []
    const record = (name: string) => (props: Record<string, unknown>) => {
      recorded.push({ name, props })
      return createElement(name, null, props.children as never)
    }
    const View = record('view')
    const Text = record('text')

    const theme = { space: [0, 4, 8, 16] }
    const { styled } = createStyle(theme)
    const tablet = `@media (width >= ${600}px)`

    const Row = styled(View)(({ theme }) => ({
      flexDirection: 'column',
      gap: theme.space[1],
      [tablet]: { flexDirection: 'row', gap: theme.space[3] },
    }))

    function Toolbar() {
      const isWide = useMediaQuery('(min-width: 600px)')
      return <Row>{isWide ? <Text>Save and close</Text> : <Text>Save</Text>}</Row>
    }

    const { container } = render(<Toolbar />)
    expect(container.textContent).toBe('Save')
    expect(recorded[0].props.style).toEqual([{ flexDirection: 'column', gap: 4 }])
    resize(700)
    expect(container.textContent).toBe('Save and close')
    expect(recorded.at(-2)?.props.style).toEqual([{ flexDirection: 'row', gap: 16 }])
  })
})

describe('the window store', () => {
  it('listens to the platform once, while it has subscribers, and reads the window now', () => {
    const first = vi.fn()
    const second = vi.fn()
    const stopFirst = subscribeToWindow(first)
    const stopSecond = subscribeToWindow(second)
    expect(platform.countListeners()).toBe(3)
    platform.resize(1000, 500)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    expect(readWindowState()).toEqual({
      width: 1000,
      height: 500,
      colorScheme: 'light',
      isReducedMotion: false,
    })
    stopFirst()
    expect(platform.countListeners()).toBe(3)
    stopSecond()
    expect(platform.countListeners()).toBe(0)
  })
})
