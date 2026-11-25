import { expect, type Page } from '@playwright/test'
import { expectSameStyles } from './computedStyles'
import {
  DEVELOPMENT_TOOLS,
  expectQuiet,
  load,
  openWatched,
  readBody,
  readNonce,
  readPlain,
  readStyleNonces,
  type CspScenario,
  type CspTier,
} from './csp'
import { readStyle } from './registry'

// The scenarios of a page of server components under a strict content security policy, in the App Router
// fixture (`app/(csp-server)`, `proxy.ts`): a new nonce for each request, `style-src 'nonce-<n>'` with no
// 'unsafe-inline', every class made by styled server components, and the nonce of each request given by
// the source that the app registers with `setNonceSource` (`app/(csp-server)/nonce.ts`), not by a prop
// of the layout. Both tiers run them, from `tests/next-app.csp-server.spec.ts` and
// `dev-tests/csp-server.spec.ts`.

/** The routes of server components under the policy. */
const PAGES = { home: '/csp-server', other: '/csp-server/other' } as const

/** The style elements of server components: React's, by precedence, and those of the cache. */
const SERVER_STYLES = 'style[data-precedence], style[data-style]'

/** The nonce of every style element (on the development server, of every one of the engine), and how many there are. */
async function readNonces(page: Page, tier: CspTier): Promise<string[]> {
  return readStyleNonces(page, tier === 'production' ? 'style' : SERVER_STYLES)
}

/** Moves to the other page with the page's own link, and fails on a document load. */
async function navigate(page: Page): Promise<void> {
  await page.evaluate(() => {
    ;(window as unknown as { __hasStayed: boolean }).__hasStayed = true
  })
  await page.getByTestId('link-csp-server-other').click()
  await page.getByTestId('page-csp-server-other').waitFor()
  await page.waitForLoadState('networkidle')
  const hasStayed = await page.evaluate(
    () => (window as unknown as { __hasStayed?: boolean }).__hasStayed
  )
  expect(hasStayed, 'the link made a document load, not a client-side navigation').toBe(true)
}

export const CSP_SERVER_SCENARIOS: readonly CspScenario[] = [
  {
    title:
      '(h) server components, first load: styled under the policy, every style element carries the nonce, nothing is refused',
    known:
      'KNOWN: Next.js 16.4.6 gives React the nonce of the request as a string, which React takes as the script nonce only, so the <style data-precedence> element that React writes for the classes of server components has no nonce and the policy refuses it, whatever nonce the elements carry as props (React writes the attribute from its render option, not from the props).',
    async run(_page, tools, tier) {
      const plain = await readPlain(tools, PAGES.home, 'page-csp-server')
      const { page, reports } = await openWatched(tools)
      const nonce = readNonce(await load(page, PAGES.home, 'page-csp-server'))
      expectSameStyles(
        await readBody(page),
        plain,
        'the page of server components under the policy'
      )
      const nonces = await readNonces(page, tier)
      expect(nonces.length, 'style elements').toBeGreaterThan(0)
      expect(nonces, 'the nonce of every style element').toEqual(nonces.map(() => nonce))
      expect(await readStyle(page, 'csp-server-home-card', 'padding-left')).toBe('16px')
      expectQuiet(reports, 'on the first load', tier)
      await page.context().close()
    },
  },
  {
    title:
      '(i) server components, a client-side navigation to a page with classes of its own: its style elements are let in',
    known:
      'KNOWN: the request of a client-side navigation goes through proxy.ts, which gives it a nonce of its own; the style elements of that request carry it, and React inserts them with it, but the policy of the document allows the nonce of the first request only, and refuses them.',
    async run(_page, tools, tier) {
      const plain = await readPlain(tools, PAGES.other, 'page-csp-server-other')
      const { page, reports } = await openWatched(tools)
      await load(page, PAGES.home, 'page-csp-server')
      await navigate(page)
      expectSameStyles(await readBody(page), plain, 'the page reached by a navigation')
      expect(await readStyle(page, 'csp-server-other-card', 'padding-left')).toBe('24px')
      expect(await readStyle(page, 'csp-server-other-card', 'animation-name')).toContain(
        'csp-server-pulse'
      )
      const nonces = await readNonces(page, tier)
      expect(nonces, 'a style element with no nonce').not.toContain('(none)')
      expectQuiet(reports, 'after the navigation', tier)
      await page.context().close()
    },
  },
  {
    title:
      '(j) server components, the HTML as sent: every style element carries the nonce of its response, another one in each request',
    known:
      'KNOWN: Next.js 16.4.6 gives React the nonce of the request as a string, which React takes as the script nonce only, so the <style data-precedence> element that React writes for the classes of server components has no nonce and the policy refuses it, whatever nonce the elements carry as props (React writes the attribute from its render option, not from the props).',
    async run(_page, tools) {
      const url = `http://localhost:${tools.fixture.port}${PAGES.home}`
      const nonces: string[] = []
      for (let index = 0; index < 2; index++) {
        const response = await tools.request.get(url)
        const nonce = readNonce(response.headers()['content-security-policy'] ?? '')
        const tags = [...(await response.text()).matchAll(/<style[^>]*>/g)].map(([tag]) => tag)
        expect(tags.length, 'style elements in the HTML').toBeGreaterThan(0)
        for (const tag of tags) expect(tag, 'a style element').toContain(`nonce="${nonce}"`)
        nonces.push(nonce)
      }
      expect(nonces[0]).not.toBe(nonces[1])
    },
  },
  {
    title:
      '(l) server components: every style element of the payload carries the nonce of its own request, in a full render and in the render of a navigation',
    async run(_page, tools) {
      const base = `http://localhost:${tools.fixture.port}`
      for (const [path, headers] of [
        [PAGES.home, {}],
        [PAGES.other, { RSC: '1' }],
      ] as const) {
        const response = await tools.request.get(`${base}${path}`, { headers })
        const nonce = readNonce(response.headers()['content-security-policy'] ?? '')
        // The props of each style element of the server components, as the payload holds them.
        const text = (await response.text()).replaceAll('\\"', '"')
        const props = [...text.matchAll(/"precedence":"cspsrv"(,"nonce":"([^"]*)")?/g)]
        expect(props.length, `style elements in the payload of ${path}`).toBeGreaterThan(0)
        expect(
          props.map(([, , value]) => value),
          `the nonce of each style element of ${path}`
        ).toEqual(props.map(() => nonce))
      }
    },
  },
  {
    title:
      '(k) server components, the negative control: with no nonce from a source the browser refuses the styles, before and after a navigation',
    async run(_page, tools) {
      const { page, reports } = await openWatched(tools)
      await page.context().addCookies([
        {
          name: 'csp-control',
          value: 'no-source',
          url: `http://localhost:${tools.fixture.port}`,
        },
      ])
      const policy = await load(page, PAGES.home, 'page-csp-server')
      expect(policy).toContain("style-src 'nonce-")
      expect(await readStyle(page, 'csp-server-home-card', 'padding-left')).not.toBe('16px')
      await navigate(page)
      expect(await readStyle(page, 'csp-server-other-card', 'padding-left')).not.toBe('24px')
      const refused = reports.violations.filter(({ source }) => !source.includes(DEVELOPMENT_TOOLS))
      expect(refused.length, 'violations of the policy').toBeGreaterThan(0)
      expect(refused.every(({ text }) => text.startsWith('style-src'))).toBe(true)
      await page.context().close()
    },
  },
]
