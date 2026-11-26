import { expect, type Page } from '@playwright/test'
import { collectComputedStyles, expectSameStyles, type ComputedStyles } from './computedStyles'
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
import { waitForHydrated } from './navigation'
import { readStyle, type RegistryTools } from './registry'

// The scenarios of a page of server components under a strict content security policy, in the App Router
// fixture (`app/(csp-server)`, `proxy.ts`): a new nonce for each request, `style-src 'nonce-<n>'` with no
// 'unsafe-inline', every class made by styled server components, and the nonce of each request given by
// the source that the app registers with `setNonceSource` (`app/(csp-server)/nonce.ts`), not by a prop
// of the layout. In such a request the server build sends the styles to `NonceStyles`: a `<style nonce>`
// in place in the first HTML, written into the head with the document's nonce in the browser. Both tiers
// run them, from `tests/next-app.csp-server.spec.ts` and `dev-tests/csp-server.spec.ts`. The last three
// scenarios (p, p2, q) are the routes of `app/(csp-fixed)`: ONE nonce fixed on the engine's cache, the same in
// every response and in the policy, and no nonce from a source (the source answers `undefined` there).

/** The routes of server components under the policy. */
const PAGES = {
  home: '/csp-server',
  other: '/csp-server/other',
  stream: '/csp-server/stream',
} as const

/** The routes of server components with ONE nonce fixed on the engine's cache and no nonce of a source. */
const FIXED_PAGES = { home: '/csp-fixed', other: '/csp-fixed/other' } as const

/** The style elements of server components: React's, by precedence, and those of the cache. */
const SERVER_STYLES = 'style[data-precedence], style[data-style]'

/** The style elements that `NonceStyles` renders in place in the first HTML. */
const IN_PLACE = 'style[data-umber-inline]'

/** The nonce of every style element (on the development server, of every one of the engine), and how many there are. */
async function readNonces(page: Page, tier: CspTier): Promise<string[]> {
  return readStyleNonces(page, tier === 'production' ? 'style' : SERVER_STYLES)
}

/** How many style elements in place the page holds. */
const countInPlace = (page: Page) =>
  page.evaluate((selector) => document.querySelectorAll(selector).length, IN_PLACE)

/** Waits until the elements of the first HTML have handed their rules to the head and left their place. */
async function expectHanded(page: Page): Promise<void> {
  await expect.poll(() => countInPlace(page), 'style elements left in place').toBe(0)
}

/**
 * The computed styles of the body element and of the page whose test id is `testId`. After a client-side
 * navigation Next.js puts the new page after its route announcer and its scripts, and it adds the
 * announcer at hydration, so the paths of the other children of the body differ whatever the styles.
 */
async function readPage(page: Page, testId: string): Promise<ComputedStyles> {
  const body = await readBody(page)
  const main = await collectComputedStyles(page, `[data-testid="${testId}"]`)
  return { body: body.body, ...main }
}

/** Moves to the other page with the page's own link, and fails on a document load. */
async function navigate(
  page: Page,
  link = 'link-csp-server-other',
  target = 'page-csp-server-other'
): Promise<void> {
  await page.evaluate(() => {
    ;(window as unknown as { __hasStayed: boolean }).__hasStayed = true
  })
  await page.getByTestId(link).click()
  await page.getByTestId(target).waitFor()
  await page.waitForLoadState('networkidle')
  const hasStayed = await page.evaluate(
    () => (window as unknown as { __hasStayed?: boolean }).__hasStayed
  )
  expect(hasStayed, 'the link made a document load, not a client-side navigation').toBe(true)
}

/** A page with scripting disabled at `path`, loaded to its end: its styles, and the policy's refusals. */
async function openNoScript(tools: RegistryTools, path: string, testId: string) {
  const context = await tools.browser.newContext({
    baseURL: `http://localhost:${tools.fixture.port}`,
    javaScriptEnabled: false,
  })
  const page = await context.newPage()
  const refused: string[] = []
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) refused.push(message.text())
  })
  await page.goto(path, { waitUntil: 'load' })
  await page.getByTestId(testId).waitFor()
  return { page, refused }
}

/**
 * The nonce of each element of a payload of server components that carries styles: the props of
 * `NonceStyles` (`"prefix":"cspsrv","texts":...`) and of `ProviderScope` (`"prefix":"cspsrv","given":...`,
 * its nonce in its theme), each read up to the next element of the prefix. `(none)` for one with none.
 */
function readPayloadNonces(payload: string): string[] {
  const marker = '"nonce":"'
  return payload
    .replaceAll(String.raw`\"`, '"')
    .split('"prefix":"cspsrv"')
    .slice(1)
    .filter((part) => part.startsWith(',"texts":') || part.startsWith(',"given":'))
    .map((part) => {
      const start = part.indexOf(marker)
      if (start === -1) return '(none)'
      const from = start + marker.length
      return part.slice(from, part.indexOf('"', from))
    })
}

export const CSP_SERVER_SCENARIOS: readonly CspScenario[] = [
  {
    title:
      '(h) server components, first load: styled under the policy, every style element carries the nonce, nothing is refused',
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
      await expectHanded(page)
      expectQuiet(reports, 'on the first load', tier)
      await page.context().close()
    },
  },
  {
    title:
      '(h2) server components, first load with JavaScript off: styled under the policy as the page with no policy is',
    async run(_page, tools) {
      const plain = await openNoScript(tools, `${PAGES.home}?control=no-policy`, 'page-csp-server')
      const plainStyles = await readBody(plain.page)
      await plain.page.context().close()
      const { page, refused } = await openNoScript(tools, PAGES.home, 'page-csp-server')
      expect(await countInPlace(page), 'style elements in place').toBeGreaterThan(0)
      expect(await readStyle(page, 'csp-server-home-card', 'padding-left')).toBe('16px')
      expectSameStyles(
        await readBody(page),
        plainStyles,
        'the page with no script under the policy'
      )
      expect(refused, 'refusals of the policy').toEqual([])
      await page.context().close()
    },
  },
  {
    title:
      '(h3) server components, first load: hydration changes no computed style, the first HTML before any script file runs is styled as the page after it',
    async run(_page, tools, tier) {
      const { page, reports } = await openWatched(tools)
      // Every script file waits until the styles of the first HTML are read.
      let release: () => void = () => undefined
      const released = new Promise<void>((resolve) => (release = resolve))
      await page.context().route(
        (url) => url.pathname.endsWith('.js'),
        async (route) => {
          await released
          await route.continue()
        }
      )
      await page.goto(PAGES.home, { waitUntil: 'domcontentloaded' })
      await page.getByTestId('page-csp-server').waitFor()
      expect(await countInPlace(page), 'style elements in place before hydration').toBeGreaterThan(
        0
      )
      const before = await readPage(page, 'page-csp-server')
      release()
      await waitForHydrated(page)
      await page.waitForLoadState('networkidle')
      await expectHanded(page)
      expectSameStyles(
        await readPage(page, 'page-csp-server'),
        before,
        'the page after hydration, against its first HTML'
      )
      expectQuiet(reports, 'through hydration', tier)
      await page.context().close()
    },
  },
  {
    title:
      '(i) server components, a client-side navigation to a page with classes of its own: its style elements are let in',
    async run(_page, tools, tier) {
      const { page: plainPage } = await openWatched(tools)
      await load(plainPage, `${PAGES.other}?control=no-policy`, 'page-csp-server-other')
      const plain = await readPage(plainPage, 'page-csp-server-other')
      await plainPage.context().close()
      const { page, reports } = await openWatched(tools)
      await load(page, PAGES.home, 'page-csp-server')
      await navigate(page)
      expectSameStyles(
        await readPage(page, 'page-csp-server-other'),
        plain,
        'the page reached by a navigation'
      )
      expect(await readStyle(page, 'csp-server-other-card', 'padding-left')).toBe('24px')
      expect(await readStyle(page, 'csp-server-other-card', 'animation-name')).toContain(
        'csp-server-pulse'
      )
      const nonces = await readNonces(page, tier)
      expect(nonces, 'a style element with no nonce').not.toContain('(none)')
      expect(await countInPlace(page), 'style elements in place after the navigation').toBe(0)
      expectQuiet(reports, 'after the navigation', tier)
      await page.context().close()
    },
  },
  {
    title:
      '(j) server components, the HTML as sent: every style element carries the nonce of its response, another one in each request',
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
        const nonces = readPayloadNonces(await response.text())
        expect(nonces.length, `elements with styles in the payload of ${path}`).toBeGreaterThan(0)
        expect(nonces, `the nonce of each of them in ${path}`).toEqual(nonces.map(() => nonce))
      }
    },
  },
  {
    title:
      '(m) server components, the negative control: a style element injected with no nonce stays refused and unapplied, before and after a navigation',
    async run(_page, tools, tier) {
      const { page, reports } = await openWatched(tools)
      await load(page, `${PAGES.other}?control=no-policy`, 'page-csp-server-other')
      // The class of the other page's card, which the navigation will need.
      const otherClass = await page
        .getByTestId('csp-server-other-card')
        .evaluate((element) => element.className.split(' ')[0])
      await load(page, PAGES.home, 'page-csp-server')
      const injected = await page.evaluate((name) => {
        const rule = (selector: string) => `${selector}{padding-left:99px !important}`
        // As an element of the head written for a navigation would be, with the href it needs.
        const head = document.createElement('style')
        head.dataset.precedence = 'cspsrv'
        head.dataset.href = name
        head.textContent = rule('[data-testid="csp-server-home-card"]')
        document.head.append(head)
        // As markup in the body, as an element of the first HTML would be.
        document.body.insertAdjacentHTML(
          'beforeend',
          `<style data-umber-inline="cspsrv ${name}">${rule('[data-testid="csp-server-other-card"]')}</style>`
        )
        return document.querySelectorAll('style:not([nonce])').length
      }, otherClass)
      expect(injected, 'injected elements').toBeGreaterThanOrEqual(2)
      const isOutsideTools = ({ source }: { source: string }) => !source.includes(DEVELOPMENT_TOOLS)
      await expect
        .poll(() => reports.violations.filter(isOutsideTools).length)
        .toBeGreaterThanOrEqual(2)
      expect(await readStyle(page, 'csp-server-home-card', 'padding-left')).toBe('16px')
      const before = reports.violations.length
      await navigate(page)
      expect(await readStyle(page, 'csp-server-other-card', 'padding-left')).toBe('24px')
      const applied = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLStyleElement>('style:not([nonce])')].map(
          (element) => element.sheet !== null
        )
      )
      expect(applied, 'the injected elements have no sheet').not.toContain(true)
      const after = reports.violations
        .slice(before)
        .filter((violation) => tier === 'production' || isOutsideTools(violation))
      expect(after, 'violations of the navigation').toEqual([])
      await page.context().close()
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
  {
    title:
      '(n) server components, a page that streams: the late chunk is styled under the policy, its props class after the base class it shares with the first flush, nothing is refused',
    async run(_page, tools, tier) {
      const { page: plainPage } = await openWatched(tools)
      await load(plainPage, `${PAGES.stream}?control=no-policy`, 'csp-server-late')
      const plain = await readPage(plainPage, 'page-csp-server-stream')
      await plainPage.context().close()
      const { page, reports } = await openWatched(tools)
      const nonce = readNonce(await load(page, PAGES.stream, 'csp-server-late'))
      await expectHanded(page)
      expectSameStyles(
        await readPage(page, 'page-csp-server-stream'),
        plain,
        'the streamed page under the policy'
      )
      expect(await readStyle(page, 'csp-server-chip', 'padding-left')).toBe('12px')
      expect(await readStyle(page, 'csp-server-late-chip', 'padding-left')).toBe('20px')
      expect(await readStyle(page, 'csp-server-late', 'padding-left')).toBe('28px')
      // The base class of the chip, sent with the first flush, comes before the props class of the late chip.
      const order = await page
        .getByTestId('csp-server-late-chip')
        .evaluate((element: HTMLElement) => {
          const hrefs = [
            ...document.head.querySelectorAll<HTMLStyleElement>('style[data-href]'),
          ].map(({ dataset }) => dataset.href)
          return element.className.split(' ').map((name: string) => hrefs.indexOf(name))
        })
      expect(order.length, 'the base class and the props class').toBe(2)
      expect(order[0], 'the base class in the head').toBeGreaterThanOrEqual(0)
      expect(order[0], 'the base class before the props class').toBeLessThan(order[1])
      const nonces = await readNonces(page, tier)
      expect(nonces, 'the nonce of every style element').toEqual(nonces.map(() => nonce))
      expectQuiet(reports, 'while the page streamed', tier)
      await page.context().close()
    },
  },
  {
    title:
      '(o) server components, a page that streams, with JavaScript off: the first flush is styled as with no policy, the late chunk stays hidden behind the fallback and carries its own rules, nothing is refused',
    async run(_page, tools) {
      const testId = 'page-csp-server-stream'
      const plain = await openNoScript(tools, `${PAGES.stream}?control=no-policy`, testId)
      const plainStyles = await readPage(plain.page, testId)
      await plain.page.context().close()
      const { page, refused } = await openNoScript(tools, PAGES.stream, testId)
      // With no script React never moves the late chunk into the boundary: the fallback stays.
      await expect(page.getByTestId('csp-server-fallback')).toBeVisible()
      await expect(page.getByTestId('csp-server-late')).toBeHidden()
      expectSameStyles(
        await readPage(page, testId),
        plainStyles,
        'the streamed page with no script'
      )
      // The hidden late chunk holds its rules in place, in order: its props class wins over the base.
      expect(await readStyle(page, 'csp-server-late-chip', 'padding-left')).toBe('20px')
      expect(await readStyle(page, 'csp-server-late', 'padding-left')).toBe('28px')
      expect(refused, 'refusals of the policy').toEqual([])
      await page.context().close()
    },
  },
  {
    title:
      '(p) server components with a fixed nonce on the cache and no nonce of a source, first load: styled under the policy that names that nonce, every style element carries it, nothing is refused',
    async run(_page, tools, tier) {
      const plain = await readPlain(tools, FIXED_PAGES.home, 'page-csp-fixed')
      const { page, reports } = await openWatched(tools)
      const nonce = readNonce(await load(page, FIXED_PAGES.home, 'page-csp-fixed'))
      expectSameStyles(await readBody(page), plain, 'the page with a fixed nonce under the policy')
      const nonces = await readNonces(page, tier)
      expect(nonces.length, 'style elements').toBeGreaterThan(0)
      expect(nonces, 'the nonce of every style element').toEqual(nonces.map(() => nonce))
      expect(await readStyle(page, 'csp-fixed-home-card', 'padding-left')).toBe('16px')
      await expectHanded(page)
      expectQuiet(reports, 'on the first load', tier)
      // The same nonce in every response: nothing in the policy changes from one request to the next.
      const again = await tools.request.get(
        `http://localhost:${tools.fixture.port}${FIXED_PAGES.home}`
      )
      expect(readNonce(again.headers()['content-security-policy'] ?? '')).toBe(nonce)
      const html = await again.text()
      const tags = [...html.matchAll(/<style[^>]*>/g)].map(([tag]) => tag)
      expect(tags.length, 'style elements in the HTML').toBeGreaterThan(0)
      for (const tag of tags) expect(tag, 'a style element').toContain(`nonce="${nonce}"`)
      await page.context().close()
    },
  },
  {
    title:
      '(p2) server components with a fixed nonce on the cache and no nonce of a source, first load with JavaScript off: styled under the policy as the page with no policy is',
    async run(_page, tools) {
      const plain = await openNoScript(
        tools,
        `${FIXED_PAGES.home}?control=no-policy`,
        'page-csp-fixed'
      )
      const plainStyles = await readBody(plain.page)
      await plain.page.context().close()
      const { page, refused } = await openNoScript(tools, FIXED_PAGES.home, 'page-csp-fixed')
      expect(await countInPlace(page), 'style elements in place').toBeGreaterThan(0)
      expect(await readStyle(page, 'csp-fixed-home-card', 'padding-left')).toBe('16px')
      expectSameStyles(
        await readBody(page),
        plainStyles,
        'the page with no script under the policy'
      )
      expect(refused, 'refusals of the policy').toEqual([])
      await page.context().close()
    },
  },
  {
    title:
      '(q) server components with a fixed nonce on the cache and no nonce of a source, a client-side navigation: the classes of the other page are let in, nothing is refused',
    async run(_page, tools, tier) {
      const { page: plainPage } = await openWatched(tools)
      await load(plainPage, `${FIXED_PAGES.other}?control=no-policy`, 'page-csp-fixed-other')
      const plain = await readPage(plainPage, 'page-csp-fixed-other')
      await plainPage.context().close()
      const { page, reports } = await openWatched(tools)
      await load(page, FIXED_PAGES.home, 'page-csp-fixed')
      await navigate(page, 'link-csp-fixed-other', 'page-csp-fixed-other')
      expectSameStyles(
        await readPage(page, 'page-csp-fixed-other'),
        plain,
        'the page reached by a navigation'
      )
      expect(await readStyle(page, 'csp-fixed-other-card', 'padding-left')).toBe('24px')
      const nonces = await readNonces(page, tier)
      expect(nonces, 'a style element with no nonce').not.toContain('(none)')
      expect(await countInPlace(page), 'style elements in place after the navigation').toBe(0)
      expectQuiet(reports, 'after the navigation', tier)
      await page.context().close()
    },
  },
]
