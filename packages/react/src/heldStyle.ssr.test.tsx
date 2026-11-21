// @vitest-environment node
import { renderToString } from 'react-dom/server'
import { createCache, createMemorySheet } from '@umber-style/core'
import { createStyle } from './createStyle'

describe('a plain object in style, in a server render of the client build', () => {
  it('writes its class for good: there is no lifecycle to let it go', () => {
    vi.useFakeTimers()
    const sheet = createMemorySheet()
    const { styled } = createStyle(
      { palette: { primary: '#0000ff' } },
      { prefix: 'n', cache: createCache({ prefix: 'n', sheet }), hasServerStyleElements: false }
    )
    const Bar = styled.div({ height: 1 })
    const html = renderToString(<Bar style={{ width: 5 }} />)
    vi.runAllTimers()
    vi.useRealTimers()
    expect(html).not.toContain('style=')
    expect(sheet.rules.filter((rule) => rule.includes('width:5px'))).toHaveLength(1)
  })
})
