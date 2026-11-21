import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createEngine } from '@umber-style/core'
import { bindEngine as bindClient } from './createStyle'
import { bindEngine as bindServer } from './createStyle.server'
import type { CacheFunction } from './serverContext'
import { createThemeProbe, nestedTheme, probeTheme } from './vitest.themeProbe'

const requestCache: CacheFunction = (make) => {
  let value: ReturnType<typeof make> | undefined
  return () => (value ??= make())
}

describe('one component source that calls useTheme(), as a client component', () => {
  it('reads the nearest provider: of the client build, and of the server build, in the same way', () => {
    const engine = createEngine(probeTheme, { prefix: 'uc' })
    const client = bindClient(engine)
    // The server build of the provider, rendered by the client build of React as a server of server
    // components renders it: its browser part is a client component here.
    const server = bindServer(engine, requestCache)
    const ThemeProbe = createThemeProbe(client)
    const container = document.createElement('div')
    const root = createRoot(container)
    act(() =>
      root.render(
        <>
          <client.ThemeProvider theme={probeTheme}>
            <client.ThemeProvider theme={nestedTheme}>
              <ThemeProbe id="client" />
            </client.ThemeProvider>
          </client.ThemeProvider>
          <server.ThemeProvider theme={{ ...probeTheme, breakpoints: ['900px'] }}>
            <server.ThemeProvider theme={nestedTheme}>
              <ThemeProbe id="server" />
            </server.ThemeProvider>
          </server.ThemeProvider>
        </>
      )
    )
    const read = (id: string) => container.querySelector(`[data-id="${id}"]`)?.textContent
    expect(read('client')).toBe('#fff4d6 600px')
    expect(read('server')).toBe('#fff4d6 900px')
    act(() => root.unmount())
  })
})
