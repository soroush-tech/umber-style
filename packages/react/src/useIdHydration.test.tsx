import {
  act,
  StrictMode,
  useId,
  type ComponentType,
  type ElementType,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { createCache } from '@umber-style/core'
import { CacheProvider } from './CacheProvider'
import { createStyle } from './createStyle'
import type { StyleProp } from './types'

const theme = { palette: { primary: '#0000ff' } }

// An id of `useId` from a server render, in the form of each React 19 minor: `:R1:` on 19.0, `«R1»`
// on 19.1, `_R_1_` from 19.2.
const SERVER_ID = /^(:R|«R|_R_)/

// The ids that `Labelled` made, in the order of its renders: the browser's are read here, because React
// keeps the attribute of the server when the two differ.
const made: string[] = []

afterEach(() => {
  made.length = 0
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** A component that writes an id of `useId` into an attribute: the id says where it is in the tree. */
function Labelled() {
  const id = useId()
  made.push(id)
  return <span data-testid="probe" id={id} />
}

/** A parent of `Labelled`. */
type Parent = (props: { children: ReactNode }) => ReactNode

interface Setup {
  /** What the styled element is given in `style`. */
  style?: StyleProp
  /** Whether the tree is under a `CacheProvider`. */
  hasProvider?: boolean
  /** Whether the tree is in React's strict mode. */
  isStrict?: boolean
  /** Whether the tree is under the outermost `ThemeProvider` of the style. */
  hasTheme?: boolean
  /** The parent of `Labelled` in place of the styled element: a plain one, to compare with. */
  makeParent?: () => Parent
}

/** The app of `setup`, made with a new style and, with a cache provider, a new cache: one for each side. */
function createApp(prefix: string, setup: Setup): ReactElement {
  const { style, hasProvider, isStrict, hasTheme, makeParent } = setup
  const { styled, ThemeProvider } = createStyle(theme, { prefix })
  const Box = styled('div', { name: 'Box' })(({ theme: view }) => ({
    color: view.palette.primary,
  }))
  const Parent: Parent = makeParent?.() ?? (({ children }) => <Box style={style}>{children}</Box>)
  let app: ReactNode = (
    <Parent>
      <Labelled />
    </Parent>
  )
  if (hasTheme) app = <ThemeProvider theme={theme}>{app}</ThemeProvider>
  if (hasProvider) app = <CacheProvider value={createCache({ prefix })}>{app}</CacheProvider>
  if (isStrict) app = <StrictMode>{app}</StrictMode>
  return app as ReactElement
}

/** What `make` gives where there is no `document`, as a server has none. */
function onServer<R>(make: () => R): R {
  vi.stubGlobal('document', undefined)
  try {
    return make()
  } finally {
    vi.unstubAllGlobals()
  }
}

/** The HTML of a classic server render of `setup`. */
const renderOnServer = (prefix: string, setup: Setup) =>
  onServer(() => renderToString(createApp(prefix, setup)))

/** Renders `setup` on a server and hydrates it in the browser: the id that each side made, and the element. */
async function hydrateApp(prefix: string, setup: Setup) {
  const html = renderOnServer(prefix, setup)
  const container = document.createElement('div')
  container.innerHTML = html
  document.body.appendChild(container)
  const probe = container.querySelector('[data-testid="probe"]') as HTMLElement
  made.length = 0
  await act(async () => {
    hydrateRoot(container, createApp(prefix, setup))
  })
  const hydrated = container.querySelector('[data-testid="probe"]') as HTMLElement
  return { server: probe.id, browser: made.at(-1), isKept: hydrated === probe }
}

const SETUPS = [false, true].flatMap((hasProvider) =>
  [false, true].flatMap((isStrict) =>
    [undefined, { width: 5 }].map((style) => ({ style, hasProvider, isStrict }))
  )
)

describe('useId under a styled element, rendered on a server and hydrated', () => {
  it.each(SETUPS)(
    'is the id the server wrote, with no warning: style $style, cache provider $hasProvider, strict $isStrict',
    async (setup) => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const { server, browser, isKept } = await hydrateApp('uid', setup)
      expect(server).toMatch(SERVER_ID)
      expect(error).not.toHaveBeenCalled()
      expect(isKept).toBe(true)
      expect(browser).toBe(server)
    }
  )

  it.each([false, true])(
    'is the id the server wrote under the outermost ThemeProvider, cache provider %s',
    async (hasProvider) => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const { server, browser } = await hydrateApp('uit', {
        style: { width: 5 },
        hasProvider,
        hasTheme: true,
      })
      expect(error).not.toHaveBeenCalled()
      expect(browser).toBe(server)
    }
  )

  // The style elements that the server sends with a class are places in the tree for `useId`, although
  // React moves them to the head: with no style object and no cache provider, the test above fails
  // without the empty place that the browser renders for them.
  it('has the server send the style elements of the class with no cache provider', () => {
    expect(renderOnServer('uis', {})).toContain('<style data-precedence="uis"')
  })
})

/** The components that `makeApp` builds its app from: a new style for each side. */
interface Parts {
  Box: ComponentType<{ children?: ReactNode; as?: ElementType }>
  Text: ComponentType<{ children?: ReactNode; as?: ElementType }>
}

/**
 * Renders the app of `makeApp` on a server and hydrates it, with `console.error` watched: the id of the
 * last `Labelled` that each side made, and whether React printed an error.
 */
async function hydrateParts(prefix: string, makeApp: (parts: Parts) => ReactNode) {
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const app = () => {
    const { styled } = createStyle(theme, { prefix })
    const Box = styled('div', { name: 'Box' })({ color: 'red' })
    const Text = styled('p', { name: 'Text' })({ margin: 0 })
    return <>{makeApp({ Box, Text })}</>
  }
  const container = document.createElement('div')
  container.innerHTML = onServer(() => renderToString(app()))
  document.body.appendChild(container)
  const probes = container.querySelectorAll('[data-testid="probe"]')
  const server = probes[probes.length - 1]?.id
  made.length = 0
  await act(async () => {
    hydrateRoot(container, app())
  })
  return {
    server,
    browser: made.at(-1),
    hasError: error.mock.calls.length > 0,
    html: container.innerHTML,
  }
}

/** A component that renders `Labelled`: a component in `as`. */
const LabelledIn = ({ children }: { children?: ReactNode }) => (
  <em>
    {children}
    <Labelled />
  </em>
)

describe('the place of a styled element, by what is below it', () => {
  // With no component below it, the browser renders it alone: nothing below it calls `useId`.
  it('leaves the id of a component next to it as the server wrote it', async () => {
    const { server, browser, hasError, html } = await hydrateParts('uil', ({ Box, Text }) => (
      <div>
        <Box>
          {'one'} {2}
          <b>bold</b>
          <Text as="span">
            {null}
            {[true, 'text']}
          </Text>
        </Box>
        <Labelled />
      </div>
    ))
    expect(html).toContain('<style data-precedence="uil"')
    expect(hasError).toBe(false)
    expect(browser).toBe(server)
  })

  const below: [string, (parts: Parts) => ReactNode][] = [
    ['an element of a tag', () => <b>{['x', <Labelled key="l" />]}</b>],
    ['a styled element of a tag', ({ Text }) => <Text>{<Labelled />}</Text>],
    ['a component in `as`', ({ Text }) => <Text as={LabelledIn}>x</Text>],
    ['a fragment', () => <>{<Labelled />}</>],
    ['a list that is not an array', () => new Set([<Labelled key="l" />])],
  ]
  it.each(below)(
    'gives a component below it in %s the id the server wrote',
    async (_, makeChild) => {
      const { server, browser, hasError } = await hydrateParts('uib', (parts) => (
        <parts.Box>{makeChild(parts)}</parts.Box>
      ))
      expect(hasError).toBe(false)
      expect(server).toMatch(SERVER_ID)
      expect(browser).toBe(server)
    }
  )

  it.each([undefined, { width: 5 }])(
    'keeps its element when the text becomes a component and back: style %o',
    async (style) => {
      const { styled } = createStyle(theme, { prefix: 'uik' })
      const Box = styled('div', { name: 'Box' })({ color: 'red' })
      const container = document.createElement('div')
      document.body.appendChild(container)
      const root = createRoot(container)
      const show = (hasLabel: boolean) =>
        act(async () => {
          root.render(<Box style={style}>{hasLabel ? <Labelled /> : 'text'}</Box>)
        })
      await show(false)
      const element = container.firstChild
      await show(true)
      expect(container.firstChild).toBe(element)
      await show(false)
      expect(container.firstChild).toBe(element)
      await act(async () => root.unmount())
    }
  )
})

describe('a styled element under a cache provider with no plain object in style', () => {
  const plain = () => (({ children }) => <div>{children}</div>) as Parent

  it.each([undefined, []])(
    'is in the place of a plain element, on a server and in the browser: style %o',
    async (style) => {
      const expected = await hydrateApp('uip', { hasProvider: true, makeParent: plain })
      document.body.innerHTML = ''
      expect(await hydrateApp('uip', { hasProvider: true, style })).toEqual(expected)
    }
  )
})
