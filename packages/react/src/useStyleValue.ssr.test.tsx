// @vitest-environment node
import { renderToString } from 'react-dom/server'
import { createStyle } from './createStyle'

describe('useStyleValue in the client build, rendered on a server', () => {
  it('sends the first number in the styles of the page, as the fallback of the variable, with no rule for it', () => {
    expect(typeof document).toBe('undefined')
    const style = createStyle({}, { prefix: 'ss' })
    const Thumb = style.styled('div', { name: 'Thumb' })({ position: 'absolute' })
    function Slider() {
      const [left] = style.useStyleValue(25, '%')
      return <Thumb style={{ left: `${left}` }} />
    }
    const html = renderToString(<Slider />)
    expect(html).toMatch(/\{left:var\(--ss-value-\w+, 25%\);\}/)
    expect(html).not.toMatch(/--ss-value-\w+:/)
  })
})
