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
