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
// of the layout. In such a request the server build sends the styles to `NonceStyles`. Under the
// `StyleRegistry` of the layout (`/csp-server`, `/csp-fixed`) it hands them to the registry, which writes
// them in the head and at the top of the body before each later piece of the stream; with no registry
// (`/csp-inplace`, the same parts) it is a `<style nonce>` in place in the first HTML, written into the
// head with the document's nonce in the browser. Both tiers run them, from
// `tests/next-app.csp-server.spec.ts` and `dev-tests/csp-server.spec.ts`. Scenarios p, p2 and q are the
// routes of `app/(csp-fixed)`: ONE nonce fixed on the engine's cache, the same in every response and in the
// policy, and no nonce from a source (the source answers `undefined` there).

/** The routes of server components under the policy, with the registry. */
const PAGES = {
  home: '/csp-server',
  other: '/csp-server/other',
  stream: '/csp-server/stream',
  badge: '/csp-server/badge',
  interactive: '/csp-server/interactive',
  helpers: '/csp-server/helpers',
} as const

/** The routes of server components under the policy with no registry: the styles in place. */
const IN_PLACE_PAGES = {
  home: '/csp-inplace',
  other: '/csp-inplace/other',
  stream: '/csp-inplace/stream',
} as const

/** The routes of server components with ONE nonce fixed on the engine's cache and no nonce of a source. */
const FIXED_PAGES = { home: '/csp-fixed', other: '/csp-fixed/other' } as const

/** The style elements of server components: React's, by precedence, those of the cache and of the registry. */
const SERVER_STYLES = 'style[data-precedence], style[data-style], style[data-umber]'

/** The style elements that `NonceStyles` renders in place in the first HTML. */
const IN_PLACE = 'style[data-umber-inline]'

/** The style elements that the `StyleRegistry` wrote. */
const REGISTERED = 'style[data-umber-registry]'

/** The prefix of the style of the server components under /csp-server and /csp-inplace. */
const PREFIX = 'cspsrv'

/** The colours of the light theme of the fixtures (fixtures/shared/src/themes.ts), as the browser computes them. */
const RGB = {
  text: 'rgb(31, 26, 23)',
  primary: 'rgb(138, 75, 42)',
  accent: 'rgb(179, 38, 30)',
} as const

/** The nonce of every style element (on the development server, of every one of the engine), and how many there are. */
async function readNonces(page: Page, tier: CspTier): Promise<string[]> {
  return readStyleNonces(page, tier === 'production' ? 'style' : SERVER_STYLES)
}

/**
 * That the browser's cache of the client build made a style element of its own (`data-style`), and that
 * it and every other style element carry `nonce`, the nonce of the document.
 */
async function expectCacheNonce(page: Page, tier: CspTier, nonce: string): Promise<void> {
  const own = await readStyleNonces(page, `style[data-style="${PREFIX}"]`)
  expect(own.length, "the style elements of the browser's cache").toBeGreaterThan(0)
  expect(own, "the nonce of the browser's cache").toEqual(own.map(() => nonce))
  const nonces = await readNonces(page, tier)
  expect(nonces, 'the nonce of every style element').toEqual(nonces.map(() => nonce))
}

/** How many style elements in place the page holds. */
const countInPlace = (page: Page) =>
  page.evaluate((selector) => document.querySelectorAll(selector).length, IN_PLACE)

/** How many style elements the registry wrote. */
const countRegistered = (page: Page) =>
  page.evaluate((selector) => document.querySelectorAll(selector).length, REGISTERED)

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

/** A style element of the HTML as sent: where it starts, the element it is a child of, its nonce, and the classes and texts it holds. */
interface SentStyleElement {
  start: number
  parent: string
  nonce: string
  hrefs: string[]
}

/** The style elements of the HTML as sent, and the place of the first element of each class of a prefix. */
interface SentLayout {
  styles: SentStyleElement[]
  firstUse: Map<string, number>
}

/** Elements that have no end tag. */
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
])

/** Elements whose text is not markup. */
const TEXT_ELEMENTS = new Set(['script', 'style', 'textarea', 'title'])

/** The value of the attribute `name` in the attributes of a start tag, or undefined. */
function readTagAttribute(attributes: string, name: string): string | undefined {
  return new RegExp(String.raw`\s${name}="([^"]*)"`).exec(attributes)?.[1]
}

/** The texts a style element holds, by `href`: of React (`data-href`), of the registry (`data-umber`), in place (`data-umber-inline`). */
function readStyleHrefs(attributes: string, prefix: string): string[] {
  const named =
    readTagAttribute(attributes, 'data-href') ??
    readTagAttribute(attributes, 'data-umber') ??
    readTagAttribute(attributes, 'data-umber-inline') ??
    ''
  return named.split(' ').filter((name) => name.startsWith(`${prefix}-`))
}

/** Adds each class of `prefix` in `attributes` that `firstUse` does not hold, at `start`. */
function addFirstUse(
  firstUse: Map<string, number>,
  attributes: string,
  prefix: string,
  start: number
) {
  for (const className of (readTagAttribute(attributes, 'class') ?? '').split(' ')) {
    if (className.startsWith(`${prefix}-`) && !firstUse.has(className))
      firstUse.set(className, start)
  }
}

/**
 * Reads the HTML as sent, as text, with no DOM: the start of each style element, the element it is a child
 * of (from the tags before it; void elements, and the text of `script` and `style`, left out), and the
 * start of the first element of each class of `prefix`.
 */
function readSentLayout(html: string, prefix: string): SentLayout {
  const open: string[] = []
  const styles: SentStyleElement[] = []
  const firstUse = new Map<string, number>()
  const tags = /<(\/?)([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g
  for (let match = tags.exec(html); match !== null; match = tags.exec(html)) {
    const [, closing, tagName, attributes] = match
    const name = tagName.toLowerCase()
    if (closing) {
      const index = open.lastIndexOf(name)
      if (index !== -1) open.length = index
      continue
    }
    if (name === 'style') {
      const nonce = readTagAttribute(attributes, 'nonce') ?? '(none)'
      const hrefs = readStyleHrefs(attributes, prefix)
      styles.push({ start: match.index, parent: open.at(-1) ?? '', nonce, hrefs })
    }
    addFirstUse(firstUse, attributes, prefix, match.index)
    if (TEXT_ELEMENTS.has(name)) tags.lastIndex = html.indexOf(`</${name}`, tags.lastIndex)
    else if (!VOID_ELEMENTS.has(name) && !attributes.endsWith('/')) open.push(name)
  }
  return { styles, firstUse }
}

/** The HTML of `path` as sent, byte for byte (each byte one character), and the policy of the response. */
async function fetchSent(tools: RegistryTools, path: string) {
  const response = await tools.request.get(`http://localhost:${tools.fixture.port}${path}`)
  const html = Buffer.from(await response.body()).toString('latin1')
  return { html, policy: response.headers()['content-security-policy'] ?? '' }
}

/** The classes whose first element in the HTML comes before any style element that holds their rule. */
function findLateClasses(styles: readonly SentStyleElement[], firstUse: Map<string, number>) {
  return [...firstUse]
    .filter(([name, start]) => {
      const rule = styles.find(({ hrefs }) => hrefs.includes(name))
      return rule === undefined || rule.start > start
    })
    .map(([name]) => name)
}

/** The texts that more than one style element holds. */
function findRepeated(styles: readonly SentStyleElement[]): string[] {
  const counts = new Map<string, number>()
  for (const { hrefs } of styles) {
    for (const href of hrefs) counts.set(href, (counts.get(href) ?? 0) + 1)
  }
  return [...counts].filter(([, count]) => count > 1).map(([href]) => href)
}

/**
 * In the HTML of `path` as sent, under the registry: no style element of the engine inside an element of
 * the page (each is a child of the head or of the body), each with the nonce of the response; the rule of
 * every class before the first element with the class; one style element for each class.
 */
async function expectSentInOrder(tools: RegistryTools, path: string, prefix: string) {
  const { html, policy } = await fetchSent(tools, path)
  const nonce = readNonce(policy)
  const { styles, firstUse } = readSentLayout(html, prefix)
  const engine = styles.filter(({ hrefs }) => hrefs.length > 0)
  expect(engine.length, `style elements of the engine in ${path}`).toBeGreaterThan(0)
  expect(firstUse.size, `classes of the engine in ${path}`).toBeGreaterThan(0)
  const parents = engine.map(({ parent }) => parent)
  expect(parents, `the parent of each style element in ${path}`).toEqual(
    parents.map((parent) => (parent === 'head' ? 'head' : 'body'))
  )
  const nonces = engine.map((style) => style.nonce)
  expect(nonces, `the nonce of each style element in ${path}`).toEqual(nonces.map(() => nonce))
  expect(findLateClasses(engine, firstUse), `rules after their first element in ${path}`).toEqual(
    []
  )
  expect(findRepeated(engine), `classes sent more than once in ${path}`).toEqual([])
}

/**
 * Watches the page from its first byte (an init script): each element with a class of `prefix` that is
 * shown (not in a hidden part of the stream, nor in a template) while no style element that the policy let
 * in holds a rule of that class. `window.__flashes` lists them.
 */
function watchFlashes(prefix: string): void {
  const flashes: { testId: string | null; classes: string[] }[] = []
  ;(window as unknown as { __flashes: typeof flashes }).__flashes = flashes
  const readHeld = () => {
    const held = new Set<string>()
    for (const element of document.querySelectorAll<HTMLStyleElement>('style')) {
      if (element.sheet === null) continue
      const { href, umber, umberInline } = element.dataset
      for (const name of (href ?? umber ?? umberInline ?? '').split(' ')) held.add(name)
    }
    return held
  }
  const readAbsent = (element: Element, held: Set<string>) =>
    [...element.classList].filter((name) => name.startsWith(`${prefix}-`) && !held.has(name))
  const isShown = (element: Element) =>
    element.isConnected && element.closest('[hidden], template') === null
  const observer = new MutationObserver((records) => {
    const held = readHeld()
    const added = records.flatMap(({ addedNodes }) => [...addedNodes])
    for (const node of added.filter((each): each is Element => each.nodeType === 1)) {
      for (const element of [node, ...node.querySelectorAll('[class]')]) {
        const absent = readAbsent(element, held)
        if (absent.length === 0 || !isShown(element)) continue
        flashes.push({ testId: element.getAttribute('data-testid'), classes: absent })
      }
    }
  })
  observer.observe(document, { childList: true, subtree: true })
}

/** The place, in document order among the style elements the policy let in, of the first one that holds each of `names`; -1 for none. */
const readStyleOrder = (page: Page, names: readonly string[]) =>
  page.evaluate((wanted) => {
    const elements = [...document.querySelectorAll<HTMLStyleElement>('style')].filter(
      (element) => element.sheet !== null
    )
    return wanted.map((name) =>
      elements.findIndex((element) =>
        (element.dataset.href ?? element.dataset.umber ?? '').split(' ').includes(name)
      )
    )
  }, names)

/** The computed color and top margin of each item of a list, by test id. */
async function readItems(page: Page, testIds: readonly string[]) {
  const items: { color: string; marginTop: string }[] = []
  for (const testId of testIds) {
    items.push({
      color: await readStyle(page, testId, 'color'),
      marginTop: await readStyle(page, testId, 'margin-top'),
    })
  }
  return items
}

/** What the items of a list of three compute to: the first and the second by their place, the others by `& + &`. */
const LIST_OF_THREE = [
  { color: RGB.accent, marginTop: '1px' },
  { color: RGB.primary, marginTop: '9px' },
  { color: RGB.text, marginTop: '9px' },
]

export const CSP_SERVER_SCENARIOS: readonly CspScenario[] = [
  {
    title:
      '(h) server components with no registry, first load: styled under the policy, every style element carries the nonce, nothing is refused',
    async run(_page, tools, tier) {
      const plain = await readPlain(tools, IN_PLACE_PAGES.home, 'page-csp-server')
      const { page, reports } = await openWatched(tools)
      const nonce = readNonce(await load(page, IN_PLACE_PAGES.home, 'page-csp-server'))
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
      '(h2) server components with no registry, first load with JavaScript off: styled under the policy as the page with no policy is',
    async run(_page, tools) {
      const plain = await openNoScript(
        tools,
        `${IN_PLACE_PAGES.home}?control=no-policy`,
        'page-csp-server'
      )
      const plainStyles = await readBody(plain.page)
      await plain.page.context().close()
      const { page, refused } = await openNoScript(tools, IN_PLACE_PAGES.home, 'page-csp-server')
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
      '(h3) server components with no registry, first load: hydration changes no computed style, the first HTML before any script file runs is styled as the page after it',
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
      await page.goto(IN_PLACE_PAGES.home, { waitUntil: 'domcontentloaded' })
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
      '(i) server components with no registry, a client-side navigation to a page with classes of its own: its style elements are let in',
    async run(_page, tools, tier) {
      const { page: plainPage } = await openWatched(tools)
      await load(plainPage, `${IN_PLACE_PAGES.other}?control=no-policy`, 'page-csp-server-other')
      const plain = await readPage(plainPage, 'page-csp-server-other')
      await plainPage.context().close()
      const { page, reports } = await openWatched(tools)
      await load(page, IN_PLACE_PAGES.home, 'page-csp-server')
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
      '(n) server components with no registry, a page that streams: the late chunk is styled under the policy, its props class after the base class it shares with the first flush, nothing is refused',
    async run(_page, tools, tier) {
      const { page: plainPage } = await openWatched(tools)
      await load(plainPage, `${IN_PLACE_PAGES.stream}?control=no-policy`, 'csp-server-late')
      const plain = await readPage(plainPage, 'page-csp-server-stream')
      await plainPage.context().close()
      const { page, reports } = await openWatched(tools)
      const nonce = readNonce(await load(page, IN_PLACE_PAGES.stream, 'csp-server-late'))
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
      '(o) server components with no registry, a page that streams, with JavaScript off: the first flush is styled as with no policy, the late chunk stays hidden behind the fallback and carries its own rules, nothing is refused',
    async run(_page, tools) {
      const testId = 'page-csp-server-stream'
      const plain = await openNoScript(tools, `${IN_PLACE_PAGES.stream}?control=no-policy`, testId)
      const plainStyles = await readPage(plain.page, testId)
      await plain.page.context().close()
      const { page, refused } = await openNoScript(tools, IN_PLACE_PAGES.stream, testId)
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
      // Under the registry of the layout nothing is in place: the registry wrote the styles in the head.
      expect(await countInPlace(page), 'style elements in place').toBe(0)
      expect(await countRegistered(page), 'style elements of the registry').toBeGreaterThan(0)
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
  {
    title:
      '(r) server components with the registry, the HTML as sent: no style element among the elements of the page, every rule before its first element, one rule per class, each with the nonce',
    async run(_page, tools) {
      for (const path of [PAGES.home, PAGES.stream, PAGES.other]) {
        await expectSentInOrder(tools, path, PREFIX)
      }
      await expectSentInOrder(tools, FIXED_PAGES.home, 'cspfix')
      // The later pieces of the stream bring their rules at the top of the body, before them.
      const { html } = await fetchSent(tools, PAGES.stream)
      const parents = readSentLayout(html, PREFIX).styles.map(({ parent }) => parent)
      expect(parents[0], 'the style element of the first piece').toBe('head')
      expect(parents.filter((parent) => parent === 'body').length, 'of the later ones').toBe(3)
      expect(html, 'a style element in place').not.toContain('data-umber-inline')
    },
  },
  {
    title:
      '(s) server components with the registry, first load, JavaScript on and off: styled as the page with no policy, :first-child, :nth-child(2) and & + & of a list included, nothing in place, nothing refused',
    async run(_page, tools, tier) {
      const items = ['csp-server-item-1', 'csp-server-item-2', 'csp-server-item-3']
      const plain = await readPlain(tools, PAGES.home, 'page-csp-server')
      const { page, reports } = await openWatched(tools)
      const nonce = readNonce(await load(page, PAGES.home, 'page-csp-server'))
      expectSameStyles(await readBody(page), plain, 'the page with the registry under the policy')
      expect(await readItems(page, items), 'the items of the list').toEqual(LIST_OF_THREE)
      const hydrated = await readPage(page, 'page-csp-server')
      expect(await countInPlace(page), 'style elements in place').toBe(0)
      const nonces = await readNonces(page, tier)
      expect(nonces, 'the nonce of every style element').toEqual(nonces.map(() => nonce))
      expectQuiet(reports, 'on the first load', tier)
      await page.context().close()

      const plainOff = await openNoScript(
        tools,
        `${PAGES.home}?control=no-policy`,
        'page-csp-server'
      )
      const plainOffStyles = await readBody(plainOff.page)
      await plainOff.page.context().close()
      const off = await openNoScript(tools, PAGES.home, 'page-csp-server')
      const offStyles = await readBody(off.page)
      expectSameStyles(offStyles, plainOffStyles, 'the page with no script')
      expectSameStyles(
        await readPage(off.page, 'page-csp-server'),
        hydrated,
        'the page with no script, against the page with it'
      )
      expect(await readItems(off.page, items), 'the items with no script').toEqual(LIST_OF_THREE)
      expect(await countInPlace(off.page), 'style elements in place').toBe(0)
      expect(off.refused, 'refusals of the policy').toEqual([])
      await off.page.context().close()
    },
  },
  {
    title:
      '(s3) server components with the registry, a client component that reads a token: its class in the first HTML is the one after hydration and has the token, no style element without the nonce, and a client-side navigation to it gives it the same class',
    async run(_page, tools, tier) {
      const { page, reports } = await openWatched(tools)
      const response = await page.goto(PAGES.badge)
      const html = (await response?.text()) ?? ''
      const nonce = readNonce(response?.headers()['content-security-policy'] ?? '')
      await page.getByTestId('page-csp-server-badge').waitFor()
      await waitForHydrated(page)
      await page.waitForLoadState('networkidle')
      const tag = /<[^>]*data-testid="csp-server-client-badge"[^>]*>/.exec(html)?.[0] ?? ''
      const sent = /\sclass="([^"]*)"/.exec(tag)?.[1]
      expect(sent, 'a class on the badge in the first HTML').toBeDefined()
      expect(
        await page.getByTestId('csp-server-client-badge').getAttribute('class'),
        'the class of the badge after hydration'
      ).toBe(sent)
      expect(await readStyle(page, 'csp-server-client-badge', 'padding-left')).toBe('6px')
      expect(await readStyle(page, 'csp-server-client-badge', 'border-bottom-color')).toBe(
        RGB.accent
      )
      const nonces = await readNonces(page, tier)
      expect(nonces, 'the nonce of every style element').toEqual(nonces.map(() => nonce))
      expectQuiet(reports, 'on the first load', tier)
      await page.context().close()

      const { page: navigated } = await openWatched(tools)
      await load(navigated, PAGES.other, 'page-csp-server-other')
      await navigate(navigated, 'link-csp-server-badge', 'page-csp-server-badge')
      expect(
        await navigated.getByTestId('csp-server-client-badge').getAttribute('class'),
        'the class of the badge after a navigation'
      ).toBe(sent)
      await navigated.context().close()
    },
  },
  {
    title:
      '(s4) server components with the registry, a client-side navigation to a client component whose class no page loaded before used: it is styled with the token, the element that the cache of the browser makes carries the nonce of the document, nothing refused',
    async run(_page, tools, tier) {
      const { page, reports } = await openWatched(tools)
      const nonce = readNonce(await load(page, PAGES.other, 'page-csp-server-other'))
      await navigate(page, 'link-csp-server-badge', 'page-csp-server-badge')
      expect(await readStyle(page, 'csp-server-client-badge', 'border-bottom-color')).toBe(
        RGB.accent
      )
      await expectCacheNonce(page, tier, nonce)
      expectQuiet(reports, 'after the navigation', tier)
      await page.context().close()
    },
  },
  {
    title:
      '(s5) server components with the registry, a client component whose state changes to a class the first HTML did not have: it is styled with the token, the element that the cache of the browser makes carries the nonce of the document, nothing refused',
    async run(_page, tools, tier) {
      const { page, reports } = await openWatched(tools)
      const nonce = readNonce(await load(page, PAGES.interactive, 'page-csp-server-interactive'))
      expect(await readStyle(page, 'csp-server-toggle', 'padding-left')).toBe('10px')
      await page.getByTestId('csp-server-toggle').click()
      await expect(page.getByTestId('csp-server-toggle')).toHaveText('loud')
      expect(await readStyle(page, 'csp-server-toggle', 'padding-left')).toBe('22px')
      expect(await readStyle(page, 'csp-server-toggle', 'color')).toBe(RGB.accent)
      await expectCacheNonce(page, tier, nonce)
      expectQuiet(reports, 'after the click', tier)
      await page.context().close()
    },
  },
  {
    title:
      '(s6) server components with the registry, a client component that only the browser renders, after a click: it is styled with the token, the element that the cache of the browser makes carries the nonce of the document, nothing refused',
    async run(_page, tools, tier) {
      const { page, reports } = await openWatched(tools)
      const nonce = readNonce(await load(page, PAGES.interactive, 'page-csp-server-interactive'))
      await page.getByTestId('csp-server-open-panel').click()
      await page.getByTestId('csp-server-panel').waitFor()
      expect(await readStyle(page, 'csp-server-panel', 'padding-left')).toBe('18px')
      expect(await readStyle(page, 'csp-server-panel', 'border-left-color')).toBe(RGB.primary)
      await expectCacheNonce(page, tier, nonce)
      expectQuiet(reports, 'after the click', tier)
      await page.context().close()
    },
  },
  {
    title:
      '(s2) server components with the registry, a page that streams, JavaScript on and off: styled as with no policy, the list of a late piece included, nothing refused',
    async run(_page, tools, tier) {
      const testId = 'page-csp-server-stream'
      const { page: plainPage } = await openWatched(tools)
      await load(plainPage, `${PAGES.stream}?control=no-policy`, 'csp-server-box')
      const plain = await readPage(plainPage, testId)
      await plainPage.context().close()
      const { page, reports } = await openWatched(tools)
      const nonce = readNonce(await load(page, PAGES.stream, 'csp-server-box'))
      expectSameStyles(await readPage(page, testId), plain, 'the streamed page with the registry')
      const items = [
        'csp-server-stream-item-1',
        'csp-server-stream-item-2',
        'csp-server-stream-item-3',
      ]
      expect(await readItems(page, items), 'the items of the late list').toEqual(LIST_OF_THREE)
      expect(await readStyle(page, 'csp-server-late-chip', 'padding-left')).toBe('20px')
      expect(await readStyle(page, 'csp-server-pill', 'padding-left')).toBe('12px')
      const nonces = await readNonces(page, tier)
      expect(nonces, 'the nonce of every style element').toEqual(nonces.map(() => nonce))
      expectQuiet(reports, 'while the page streamed', tier)
      await page.context().close()

      const plainOff = await openNoScript(tools, `${PAGES.stream}?control=no-policy`, testId)
      const plainOffStyles = await readPage(plainOff.page, testId)
      await plainOff.page.context().close()
      const off = await openNoScript(tools, PAGES.stream, testId)
      await expect(off.page.getByTestId('csp-server-fallback')).toBeVisible()
      expectSameStyles(
        await readPage(off.page, testId),
        plainOffStyles,
        'the streamed page with no script'
      )
      expect(off.refused, 'refusals of the policy').toEqual([])
      await off.page.context().close()
    },
  },
  {
    title:
      '(t) server components with the registry, a page that streams: a class shown first in the fallback of a boundary has its rule when the content replaces it, and no element is shown before its rule',
    async run(_page, tools, tier) {
      const { page, reports } = await openWatched(tools)
      await page.addInitScript(watchFlashes, PREFIX)
      await load(page, PAGES.stream, 'csp-server-box')
      await expect(page.getByTestId('csp-server-tag')).toBeVisible()
      const flashes = await page.evaluate(
        () => (window as unknown as { __flashes: unknown[] }).__flashes
      )
      expect(flashes, 'elements shown before the rule of a class').toEqual([])
      expectQuiet(reports, 'while the page streamed', tier)
      await page.context().close()
    },
  },
  {
    title:
      '(u) server components with the registry, a client-side navigation after a page that streamed: the new props class is written after the base class that a late piece brought',
    async run(_page, tools, tier) {
      const { page: plainPage } = await openWatched(tools)
      await load(plainPage, `${PAGES.other}?control=no-policy`, 'page-csp-server-other')
      const plain = await readPage(plainPage, 'page-csp-server-other')
      await plainPage.context().close()
      const { page, reports } = await openWatched(tools)
      await load(page, PAGES.stream, 'csp-server-box')
      await navigate(page)
      expectSameStyles(
        await readPage(page, 'page-csp-server-other'),
        plain,
        'the page reached by a navigation'
      )
      expect(await readStyle(page, 'csp-server-other-pill', 'padding-left')).toBe('30px')
      const names = await page
        .getByTestId('csp-server-other-pill')
        .evaluate((element) => element.className.split(' '))
      const [base, props] = await readStyleOrder(page, names)
      expect(base, 'the base class in a style element').toBeGreaterThanOrEqual(0)
      expect(base, 'the base class before the props class').toBeLessThan(props)
      const items = ['csp-server-other-item-1', 'csp-server-other-item-2']
      expect(await readItems(page, items), 'the items of the list').toEqual(
        LIST_OF_THREE.slice(0, 2)
      )
      expectQuiet(reports, 'after the navigation', tier)
      await page.context().close()
    },
  },
  {
    title:
      '(w) server components with the registry and no nonce: React sends their style elements as with no registry, and the registry holds the class of the client component only, on its page',
    async run(_page, tools) {
      const { html, policy } = await fetchSent(tools, `${PAGES.home}?control=no-policy`)
      expect(policy, 'no policy').toBe('')
      const { styles } = readSentLayout(html, PREFIX)
      const card = styles.filter(({ hrefs }) => hrefs.some((href) => href.includes('home-card')))
      expect(card.length, 'the style elements of the card').toBe(1)
      expect(html).toContain(`<style data-precedence="${PREFIX}"`)
      expect(
        html,
        'a style element of the registry on a page with no client component'
      ).not.toContain('data-umber-registry')
      const badge = await fetchSent(tools, `${PAGES.badge}?control=no-policy`)
      const registered = [...badge.html.matchAll(/<style[^>]*data-umber-registry[^>]*>/g)].map(
        ([tag]) => tag
      )
      expect(registered.length, 'style elements of the registry').toBe(1)
      expect(registered[0]).toMatch(/data-umber="cspsrv cspsrv-csp-server-client-badge-root-\w+"/)
      expect(registered[0], 'a nonce').not.toContain('nonce=')
      expect(html, 'a style element in place').not.toContain('data-umber-inline')
    },
  },
  {
    title:
      '(x) server providers given a theme with hidden helpers on its breakpoints: a client component below calls one and shows the media query of the size, in the first HTML and after hydration, and no "Only plain objects" message reaches the console (#81)',
    async run(_page, tools, tier) {
      const query = '@media (min-width:840px)'
      const { page, reports } = await openWatched(tools)
      const response = await page.goto(PAGES.helpers)
      const html = (await response?.text()) ?? ''
      await page.getByTestId('page-csp-server-helpers').waitFor()
      await waitForHydrated(page)
      await page.waitForLoadState('networkidle')
      expect(html, 'the query in the first HTML').toContain(
        `data-testid="csp-server-helpers-query">${query}</code>`
      )
      await expect(page.getByTestId('csp-server-helpers-query')).toHaveText(query)
      // On the development server React replays in the browser what the server printed while it sent
      // the payload of server components, so a theme that cannot cross shows here too.
      expect(
        reports.console.filter((line) => line.includes('Only plain objects')),
        'the message of a member that cannot cross'
      ).toEqual([])
      expectQuiet(reports, 'on the first load', tier)
      await page.context().close()
    },
  },
]
