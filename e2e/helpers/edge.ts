import { expect } from '@playwright/test'
import { expectSameStyles } from './computedStyles'
import {
  expectQuiet,
  load,
  openWatched,
  readBody,
  readNonce,
  readPlain,
  type CspScenario,
} from './csp'
import {
  countInPlace,
  expectSentInOrder,
  navigate,
  openNoScript,
  readNonces,
  readPage,
  readSentLayout,
} from './cspServer'
import { readStyle, type RegistryTools } from './registry'

// The scenarios of the edge runtime, in the App Router fixture (`app/(edge)`, `proxy.ts`): the routes of
// /csp-server rendered by the edge runtime (`export const runtime = 'edge'` in their root layout), under the
// same strict policy, with a new nonce for each request from the nonce source of server components and
// `StyleRegistry` in the root layout. Both tiers run them, from `tests/next-app.edge.spec.ts` and
// `dev-tests/edge.spec.ts`.

/** The routes on the edge runtime. */
const PAGES = { home: '/edge', other: '/edge/other', stream: '/edge/stream' } as const

/** The prefix of the style of the parts these pages share with /csp-server. */
const PREFIX = 'cspsrv'

/** The runtime that rendered `path`, as the page prints it. */
async function fetchRuntime(tools: RegistryTools, path: string): Promise<string> {
  const response = await tools.request.get(`http://localhost:${tools.fixture.port}${path}`)
  const html = await response.text()
  return /data-testid="edge-runtime"[^>]*>([^<]*)</.exec(html)?.[1] ?? '(none)'
}

export const EDGE_SCENARIOS: readonly CspScenario[] = [
  {
    title: '(e1) every page under /edge is rendered by the edge runtime',
    async run(_page, tools) {
      for (const path of Object.values(PAGES)) {
        expect(await fetchRuntime(tools, path), `the runtime of ${path}`).toBe('edge')
      }
    },
  },
  {
    title:
      '(e2) first load, JavaScript on and off: styled as the page with no policy, every style element carries the nonce, nothing in place, nothing refused',
    async run(_page, tools, tier) {
      // The body and the page, not the whole body: on the development server the number of scripts before
      // the route announcer of the framework differs with the policy, which moves its place among them.
      const { page: plainPage } = await openWatched(tools)
      await load(plainPage, `${PAGES.home}?control=no-policy`, 'page-edge')
      const plain = await readPage(plainPage, 'page-edge')
      await plainPage.context().close()
      const { page, reports } = await openWatched(tools)
      const nonce = readNonce(await load(page, PAGES.home, 'page-edge'))
      expectSameStyles(await readPage(page, 'page-edge'), plain, 'the page under the policy')
      expect(await readStyle(page, 'csp-server-client-badge', 'padding-left')).toBe('6px')
      expect(await countInPlace(page), 'style elements in place').toBe(0)
      const nonces = await readNonces(page, tier)
      expect(nonces, 'the nonce of every style element').toEqual(nonces.map(() => nonce))
      expectQuiet(reports, 'on the first load', tier)
      await page.context().close()

      const plainOff = await openNoScript(tools, `${PAGES.home}?control=no-policy`, 'page-edge')
      const plainOffStyles = await readBody(plainOff.page)
      await plainOff.page.context().close()
      const off = await openNoScript(tools, PAGES.home, 'page-edge')
      expectSameStyles(await readBody(off.page), plainOffStyles, 'with JavaScript off')
      expect(off.refused, 'what the policy refused with JavaScript off').toEqual([])
      await off.page.context().close()
    },
  },
  {
    title:
      '(e3) the HTML as sent: no style element among the elements of the page, every rule before its first element, each with the nonce; the later piece brings its rules at the top of the body',
    async run(_page, tools) {
      for (const path of Object.values(PAGES)) await expectSentInOrder(tools, path, PREFIX)
      const response = await tools.request.get(
        `http://localhost:${tools.fixture.port}${PAGES.stream}`
      )
      const html = Buffer.from(await response.body()).toString('latin1')
      const parents = readSentLayout(html, PREFIX).styles.map(({ parent }) => parent)
      expect(parents[0], 'the style element of the first piece').toBe('head')
      expect(parents.filter((parent) => parent === 'body').length, 'of the later ones').toBe(1)
    },
  },
  {
    title:
      '(e4) a client-side navigation to a page with classes of its own, rendered by the edge runtime: styled as with no policy, the nonce on every style element, nothing refused',
    async run(_page, tools, tier) {
      const { page: plainPage } = await openWatched(tools)
      await load(plainPage, `${PAGES.other}?control=no-policy`, 'page-edge-other')
      const plain = await readPage(plainPage, 'page-edge-other')
      await plainPage.context().close()
      const { page, reports } = await openWatched(tools)
      const nonce = readNonce(await load(page, PAGES.home, 'page-edge'))
      await navigate(page, 'link-csp-server-other', 'page-edge-other')
      expect(await page.getByTestId('edge-runtime').textContent()).toBe('edge')
      expectSameStyles(await readPage(page, 'page-edge-other'), plain, 'the page reached')
      expect(await readStyle(page, 'csp-server-other-card', 'padding-left')).toBe('24px')
      const nonces = await readNonces(page, tier)
      expect(nonces, 'the nonce of every style element').toEqual(nonces.map(() => nonce))
      expectQuiet(reports, 'after the navigation', tier)
      await page.context().close()
    },
  },
  {
    title:
      '(e5) a page that streams on the edge runtime: the late piece is styled as with no policy, with the nonce, nothing refused',
    async run(_page, tools, tier) {
      const plain = await readPlain(tools, PAGES.stream, 'csp-server-late')
      const { page, reports } = await openWatched(tools)
      const nonce = readNonce(await load(page, PAGES.stream, 'csp-server-late'))
      expectSameStyles(await readBody(page), plain, 'the streamed page under the policy')
      expect(await readStyle(page, 'csp-server-late', 'padding-left')).toBe('28px')
      const nonces = await readNonces(page, tier)
      expect(nonces, 'the nonce of every style element').toEqual(nonces.map(() => nonce))
      expectQuiet(reports, 'while the page streamed', tier)
      await page.context().close()
    },
  },
]
