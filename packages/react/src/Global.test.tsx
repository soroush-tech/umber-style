import { render } from '@testing-library/react'
import { StrictMode } from 'react'
import { createCache, type Sheet } from '@umber-style/core'
import { createStyle } from './createStyle'

const theme = {
  palette: { background: '#ffffff', text: '#111111' },
  breakpoints: { md: 768 },
}

/** A style over an in-memory sheet without layers that logs each rule it inserts and removes, in order. */
function setup() {
  const rules: string[] = []
  const log: string[] = []
  const sheet: Sheet = {
    rules,
    insert(rule) {
      rules.push(rule)
      log.push(`+${rule}`)
    },
    remove(index) {
      log.push(`-${rules[index]}`)
      rules.splice(index, 1)
    },
  }
  const style = createStyle(theme, {
    prefix: 'g',
    cache: createCache({ prefix: 'g', sheet, hasLayers: false }),
  })
  return { ...style, rules, log }
}

describe('Global in the browser', () => {
  it('renders nothing, writes its rules when it mounts and removes them when it unmounts', () => {
    const { Global, globalStyles, rules } = setup()
    const base = globalStyles((view) => ({
      'html, body': { margin: 0, color: view.palette.text },
    }))
    const { container, unmount } = render(<Global styles={base} />)
    expect(container.innerHTML).toBe('')
    expect(rules).toEqual(['html, body{margin:0;color:var(--g-palette-text);}'])
    unmount()
    expect(rules).toEqual([])
  })

  it('writes its rules once in StrictMode, where effects run twice, and removes them on unmount', () => {
    const { Global, rules } = setup()
    const { unmount } = render(
      <StrictMode>
        <Global styles={{ body: { margin: 0 } }} />
      </StrictMode>
    )
    expect(rules).toEqual(['body{margin:0;}'])
    unmount()
    expect(rules).toEqual([])
  })

  it('replaces its rules when the styles change, writing the new ones before it removes the old ones', () => {
    const { Global, rules, log } = setup()
    const { rerender } = render(<Global styles={{ body: { margin: 0 } }} />)
    rerender(<Global styles={{ body: { margin: 8 } }} />)
    expect(rules).toEqual(['body{margin:8px;}'])
    expect(log).toEqual(['+body{margin:0;}', '+body{margin:8px;}', '-body{margin:0;}'])
  })

  it('writes nothing again for equal styles given anew, or a theme that changes only tokens', () => {
    const { Global, ThemeProvider, rules, log } = setup()
    const styles = (view: typeof theme) => ({ body: { color: view.palette.text } })
    const { rerender } = render(
      <ThemeProvider theme={theme} isRoot>
        <Global styles={[styles]} />
      </ThemeProvider>
    )
    rerender(
      <ThemeProvider theme={{ palette: { text: '#eeeeee' } }} isRoot>
        <Global styles={[styles]} />
      </ThemeProvider>
    )
    expect(rules).toEqual(['body{color:var(--g-palette-text);}'])
    expect(log).toEqual(['+body{color:var(--g-palette-text);}'])
  })

  it('reads raw keys from the provider it is rendered under, and replaces its rules when they change', () => {
    const { Global, ThemeProvider, globalStyles, rules } = setup()
    const media = globalStyles((view) => ({
      [`@media (min-width: ${view.breakpoints.md}px)`]: { body: { color: view.palette.text } },
    }))
    const { rerender } = render(
      <ThemeProvider theme={{ breakpoints: { md: 1024 } }} isRoot>
        <Global styles={media} />
      </ThemeProvider>
    )
    expect(rules).toEqual(['@media (min-width: 1024px){body{color:var(--g-palette-text);}}'])
    rerender(
      <ThemeProvider theme={{ breakpoints: { md: 600 } }} isRoot>
        <Global styles={media} />
      </ThemeProvider>
    )
    expect(rules).toEqual(['@media (min-width: 600px){body{color:var(--g-palette-text);}}'])
  })

  it('keeps rules that two elements write until both have unmounted', () => {
    const { Global, globalStyles, rules } = setup()
    const reset = globalStyles({ '*, *::before, *::after': { boxSizing: 'border-box' } })
    const App = ({ count }: { count: number }) => (
      <>
        {count > 0 && <Global styles={reset} />}
        {count > 1 && <Global styles={{ '*, *::before, *::after': { boxSizing: 'border-box' } }} />}
      </>
    )
    const { rerender } = render(<App count={2} />)
    expect(rules).toEqual(['*, *::before, *::after{box-sizing:border-box;}'])
    rerender(<App count={1} />)
    expect(rules).toHaveLength(1)
    rerender(<App count={0} />)
    expect(rules).toEqual([])
  })

  it('writes a list in its order: handles, objects and functions of the theme', () => {
    const { Global, globalStyles, rules } = setup()
    const reset = globalStyles({ html: { WebkitTextSizeAdjust: '100%' } })
    render(
      <Global
        styles={[
          reset,
          { body: { margin: 0 } },
          (view: typeof theme) => ({ body: { background: view.palette.background } }),
        ]}
      />
    )
    expect(rules).toEqual([
      'html{-webkit-text-size-adjust:100%;}',
      'body{margin:0;}',
      'body{background:var(--g-palette-background);}',
    ])
  })

  it('writes the animations its rules use first, and leaves them when it unmounts', () => {
    const { Global, keyframes, rules } = setup()
    const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } }, { label: 'fade' })
    const { unmount } = render(<Global styles={{ body: { animation: `${fade} 1s` } }} />)
    expect(rules).toEqual([
      `@keyframes ${fade}{0%{opacity:0;}100%{opacity:1;}}`,
      `body{animation:${fade} 1s;}`,
    ])
    unmount()
    expect(rules).toEqual([`@keyframes ${fade}{0%{opacity:0;}100%{opacity:1;}}`])
  })
})

describe('an animated styled component in the browser', () => {
  it('writes the animation once, for every class that uses it, with the shorthand and the longhand', () => {
    const { styled, keyframes, rules } = setup()
    const pulse = keyframes((view) => ({
      '0%, 100%': { opacity: 1, color: view.palette.text },
      '50%': { opacity: 0.4 },
    }))
    const Skeleton = styled('div', { name: 'Skeleton' })({
      animation: `${pulse} 1.5s cubic-bezier(0.4, 0, 0.6, 1) 200ms infinite`,
    })
    const Dot = styled('span', { name: 'Dot' })({ animationName: pulse, animationDuration: 300 })
    const { container } = render(
      <>
        <Skeleton />
        <Dot />
      </>
    )
    expect(rules.filter((rule) => rule.startsWith('@keyframes'))).toEqual([
      `@keyframes ${pulse}{0%{opacity:1;color:var(--g-palette-text);}50%{opacity:0.4;}100%{opacity:1;color:var(--g-palette-text);}}`,
    ])
    const dot = container.querySelector('span') as HTMLElement
    expect(rules).toContain(`.${dot.className}{animation-name:${pulse};animation-duration:300ms;}`)
  })
})
