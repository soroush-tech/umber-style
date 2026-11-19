import { act } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { createStyle } from './createStyle'

const theme = { palette: { primary: '#0000ff' } }

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** What a classic server render makes of the app, with no `document`, as a server has none. */
function renderOnServer() {
  vi.stubGlobal('document', undefined)
  try {
    const { styled, ThemeProvider } = createStyle(theme, { prefix: 'hy' })
    const Box = styled('div', { name: 'Box' })(({ theme: view }) => ({
      color: view.palette.primary,
    }))
    return renderToString(
      <ThemeProvider theme={theme} isRoot>
        <Box data-testid="box">hello</Box>
      </ThemeProvider>
    )
  } finally {
    vi.unstubAllGlobals()
  }
}

describe('hydrating a page whose server render holds style elements that the client does not render', () => {
  it('raises no warning, keeps the markup, and inserts no rule that the page already has', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const html = renderOnServer()
    expect(html).toContain('<style data-precedence="hy"')
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    const box = container.querySelector('[data-testid="box"]')

    const { styled, ThemeProvider, cache } = createStyle(theme, { prefix: 'hy' })
    const Box = styled('div', { name: 'Box' })(({ theme: view }) => ({
      color: view.palette.primary,
    }))
    const before = cache.extract().css
    await act(async () => {
      hydrateRoot(
        container,
        <ThemeProvider theme={theme} isRoot>
          <Box data-testid="box">hello</Box>
        </ThemeProvider>
      )
    })
    expect(error).not.toHaveBeenCalled()
    expect(container.querySelector('[data-testid="box"]')).toBe(box)
    expect(cache.extract().css).toBe(before)
    expect(cache.insertOnce(box?.className as string, ['a{}'])).toBe(false)
  })
})
