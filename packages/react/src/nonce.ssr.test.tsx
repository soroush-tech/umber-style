// @vitest-environment node
import { renderToReadableStream } from 'react-dom/server'
import { createStyle } from './createStyle'

const theme = { palette: { primary: '#0000ff' } }

/** The HTML of `node` rendered with `nonce` as the script and style nonce of the render. */
async function renderWithNonce(node: React.ReactNode, nonce: string): Promise<string> {
  const stream = await renderToReadableStream(node, { nonce: { script: nonce, style: nonce } })
  await stream.allReady
  return new Response(stream).text()
}

describe('the style elements of the client build, rendered on a server', () => {
  it('carry the nonce of the cache, which React writes on the element it sends when it is the style nonce of the render', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { styled, Global, ThemeProvider, keyframes } = createStyle(theme, {
      prefix: 'ns',
      nonce: 'n0nce',
    })
    const fade = keyframes({ from: { opacity: 0 } }, { label: 'fade' })
    const Box = styled('div', { name: 'Box' })(({ theme: view }) => ({
      color: view.palette.primary,
      animation: `${fade} 1s`,
    }))
    const html = await renderWithNonce(
      <html>
        <head />
        <body>
          <ThemeProvider theme={theme}>
            <Global styles={{ body: { margin: 0 } }} />
            <Box />
          </ThemeProvider>
        </body>
      </html>,
      'n0nce'
    )
    const tags = html.match(/<style[^>]*>/g) ?? []
    expect(tags.length).toBeGreaterThan(0)
    expect(tags.every((tag) => tag.includes('nonce="n0nce"'))).toBe(true)
    expect(html).toContain('{color:var(--ns-palette-primary);animation:')
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('are sent with no nonce, and React says so, when the render has no style nonce', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { styled } = createStyle(theme, { prefix: 'nx', nonce: 'n0nce' })
    const Box = styled('div', { name: 'Box' })({ color: 'red' })
    const stream = await renderToReadableStream(
      <html>
        <head />
        <body>
          <Box />
        </body>
      </html>
    )
    await stream.allReady
    const html = await new Response(stream).text()
    expect(html).toMatch(/<style data-precedence="nx"/)
    expect(html).not.toContain('nonce=')
    expect(String(error.mock.calls[0]?.[0])).toContain('style nonce value as a render option')
    error.mockRestore()
  })
})
