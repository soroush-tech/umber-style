import { createCache, createEngine, createLazyEngine } from '@umber-style/core'
import { bindEngine } from './createStyle.server'
import { resolveTree } from './vitest.resolveTree'
import type { CacheFunction } from './serverContext'

const theme = { typography: { h3: { fontSize: '24px' } } }
type PageTheme = typeof theme

/** The slot of one request, which `React.cache` keeps inside a real server render only. */
const requestCache: CacheFunction = (make) => {
  let value: ReturnType<typeof make> | undefined
  return () => (value ??= make())
}

/** What the warning says for the component named `name`. */
const message = (name: string) =>
  `[nt] A style function of "${name}" runs in a server component with no base theme, so it reads an empty theme and a token it reads is undefined. Give the theme before the first styled call, to createStyle(theme) or configure({ theme }), or with getEngine().setTheme(theme) when it is known only later.`

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('a style function of the server build with no base theme', () => {
  it('is warned about once for each component, in development, before the function runs', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { styled } = bindEngine(
      createLazyEngine<PageTheme>({ prefix: 'nt', cache: createCache({ prefix: 'nt' }) }),
      requestCache
    )
    const order: string[] = []
    warn.mockImplementation(() => void order.push('warned'))
    const Title = styled('h3', { name: 'Title' })(({ theme: view }) => {
      order.push('called')
      return { fontSize: view.typography?.h3.fontSize }
    })
    const Plain = styled('p')(() => ({ margin: 0 }))
    function Card() {
      return null
    }
    Card.displayName = 'Card'
    const Framed = styled(Card)(() => ({ padding: 2 }))
    function Panel() {
      return null
    }
    const Boxed = styled(Panel)(() => ({ padding: 4 }))
    await resolveTree(
      <>
        <Title />
        <Title />
        <Plain />
        <Framed />
        <Boxed />
      </>
    )
    expect(order.slice(0, 2)).toEqual(['warned', 'called'])
    expect(warn.mock.calls).toEqual([
      [message('Title')],
      [message('p')],
      [message('Card')],
      [message('Panel')],
    ])
  })

  it('is not warned about with a base theme, or in production', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const given = bindEngine(
      createEngine(theme, { prefix: 'nt', cache: createCache({ prefix: 'nt' }) }),
      requestCache
    )
    const Given = given.styled('h3')(({ theme: view }) => ({
      fontSize: view.typography.h3.fontSize,
    }))
    await resolveTree(<Given />)
    vi.stubEnv('NODE_ENV', 'production')
    const none = bindEngine(
      createLazyEngine<PageTheme>({ prefix: 'nt', cache: createCache({ prefix: 'nt' }) }),
      requestCache
    )
    const Quiet = none.styled('h3')(() => ({ margin: 0 }))
    await resolveTree(<Quiet />)
    expect(warn).not.toHaveBeenCalled()
  })
})
