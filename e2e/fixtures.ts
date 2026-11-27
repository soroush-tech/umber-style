// The fixture apps the end-to-end suite runs against: one Playwright project and one web server each.

export interface FixtureConfig {
  /** The folder under fixtures/ and the name of the Playwright project. */
  name: string
  port: number
  /** The pnpm filter of the workspace package. */
  filter: string
  /** The URL of each page. */
  routes: { home: string; catalog: string; settings: string }
  /** The HTML a request gets already holds the page (prerendered or server rendered), so it works without script. */
  hasHtml: boolean
  /** The app moves between pages in the browser without a document load. */
  hasClientNavigation: boolean
  /** Whether the style is extracted from a long-lived server process that renders more than one page. */
  sharesProcess: boolean
  /** The scenarios to run, by letter. */
  scenarios: readonly string[]
  /** Scenarios that are expected to fail today, each with the reason. A scenario that passes anyway fails the run. */
  known: Readonly<Record<string, string>>
  /** The spec file that only this fixture runs, besides the shared ones. */
  only?: string
  /** The port of the development server, for the fixtures that the development tier runs. */
  devPort?: number
}

const routes = { home: '/', catalog: '/catalog', settings: '/settings' }

/**
 * Under partial prerendering (`cacheComponents`) Next.js keeps the page that a client-side navigation
 * leaves mounted, hidden by React's `Activity`, so the document holds the page left and the page reached.
 */
const KNOWN_HIDDEN_PAGE =
  'KNOWN: under partial prerendering (cacheComponents) Next.js keeps the page left in a client-side navigation in the document, hidden by an Activity, so the app root of a page reached by a navigation holds the elements of the page left too, which the comparison with a direct load reads'

/** A `Global` keeps its rules in an insertion effect, which React does not clean up in a hidden `Activity`. */
const KNOWN_HIDDEN_GLOBAL =
  'KNOWN: under partial prerendering (cacheComponents) the page left in a client-side navigation is hidden by an Activity and not unmounted; React does not clean up the insertion effect of its Global while it is hidden, so its global rule stays on the page reached'

/** The pairs of pages of scenario C, as `C:<target>:<from>`. */
const C_PAIRS = ['home', 'catalog', 'settings'].flatMap((target) =>
  ['home', 'catalog', 'settings']
    .filter((from) => from !== target)
    .map((from) => `C:${target}:${from}`)
)

export const fixtures: readonly FixtureConfig[] = [
  {
    name: 'vike-ssg',
    port: 4101,
    filter: '@umber-fixtures/vike-ssg',
    routes,
    hasHtml: true,
    hasClientNavigation: true,
    sharesProcess: true,
    scenarios: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'],
    known: {},
    only: 'vike-ssg*.spec.ts',
    devPort: 4201,
  },
  {
    name: 'next-app',
    port: 4102,
    filter: '@umber-fixtures/next-app',
    routes,
    hasHtml: true,
    hasClientNavigation: true,
    sharesProcess: false,
    scenarios: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'],
    only: 'next-app*.spec.ts',
    known: {},
    devPort: 4202,
  },
  {
    name: 'next-ppr',
    port: 4106,
    filter: '@umber-fixtures/next-ppr',
    routes,
    hasHtml: true,
    hasClientNavigation: true,
    sharesProcess: false,
    scenarios: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'],
    only: 'next-ppr*.spec.ts',
    known: {
      B: KNOWN_HIDDEN_PAGE,
      ...Object.fromEntries(C_PAIRS.map((key) => [key, KNOWN_HIDDEN_PAGE])),
      'M:promo:left': KNOWN_HIDDEN_GLOBAL,
      'M:promo:reached': KNOWN_HIDDEN_GLOBAL,
    },
    devPort: 4206,
  },
  {
    name: 'next-pages',
    port: 4103,
    filter: '@umber-fixtures/next-pages',
    routes,
    hasHtml: true,
    hasClientNavigation: true,
    sharesProcess: true,
    scenarios: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'],
    known: {},
  },
  {
    name: 'spa',
    port: 4104,
    filter: '@umber-fixtures/spa',
    routes,
    hasHtml: false,
    hasClientNavigation: true,
    sharesProcess: false,
    scenarios: ['A', 'B', 'C', 'D', 'G', 'H', 'J', 'K', 'L', 'M', 'N'],
    known: {},
    only: 'spa.spec.ts',
    devPort: 4204,
  },
  {
    name: 'vue-ssr',
    port: 4105,
    filter: '@umber-fixtures/vue-ssr',
    routes,
    hasHtml: true,
    hasClientNavigation: true,
    sharesProcess: true,
    scenarios: ['A', 'B', 'C', 'D', 'F', 'H', 'I', 'J', 'K', 'L', 'M'],
    known: {},
    only: 'vue-ssr*.spec.ts',
  },
]

export const fixtureByName = (name: string): FixtureConfig => {
  const found = fixtures.find((fixture) => fixture.name === name)
  if (!found) throw new Error(`No fixture named ${name}`)
  return found
}
