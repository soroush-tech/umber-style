import { render } from '@testing-library/react'
import { createDefaultStyle } from './defaultStyle'
import type { Theme } from './types'

// The theme of an app, which declares it as its Theme (see docs/themes.md).
const theme = { palette: { primary: '#0000ff' } } as Theme

afterEach(() => {
  vi.restoreAllMocks()
  document.head.innerHTML = ''
})

// What docs/testing.md shows for a setup file of a test run: the default style configured with the checks on.
describe('the development checks turned on in a test run', () => {
  it('warn about what a style function returns and about a value that no property takes, and not about a word', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { configure, styled } = createDefaultStyle()
    configure({ prefix: 'app', theme, hasDevChecks: true })
    const Count = styled('p')(() => 3 as never)
    const Wide = styled('p', { name: 'Wide' })({ width: true as never, borderColor: 'light' })
    render(
      <>
        <Count />
        <Wide />
      </>
    )
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      '[app] A style function returned 3, which is not a style: return a style object, a css() value, a list of them, null, undefined or false.',
      expect.stringMatching(
        /^\[app\] the class app-wide-root-\w+ of "wide-root" declares "width" as true, which is never a CSS value: give a string or a number\.$/
      ),
    ])
  })
})
