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
}

const KNOWN_SHARED_CACHE =
  'KNOWN: the engine has one cache per process and extraction returns all of it, so a page carries the rules of the other pages'

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
    scenarios: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
    // Pages are prerendered in one process, one after the other: each page carries the rules of the ones
    // rendered before it, and the first one (catalog) carries none that it does not use.
    known: {
      'E:home':
        'KNOWN: the engine has one cache per process and extraction returns all of it, so a prerendered page carries the rules of the other pages',
      'E:settings':
        'KNOWN: the engine has one cache per process and extraction returns all of it, so a prerendered page carries the rules of the other pages',
    },
  },
  {
    name: 'next-app',
    port: 4102,
    filter: '@umber-fixtures/next-app',
    routes,
    hasHtml: true,
    hasClientNavigation: true,
    sharesProcess: false,
    scenarios: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
    only: 'next-app.spec.ts',
    known: {
      // The server HTML of the root layout sends the rule of the light theme class only. The dark class
      // is made by the client engine, which prunes its variables to the ones client components use: a
      // server component's rule that uses another variable has no value under the dark class.
      'C:catalog:home':
        'KNOWN: the dark theme class holds only the variables that client components use',
      'C:settings:home':
        'KNOWN: the dark theme class holds only the variables that client components use',
      // A client component renders on the server into an in-memory sheet that nothing sends.
      'F:home': 'KNOWN: a client component is unstyled in the first HTML (its rules are not sent)',
      'F:settings':
        'KNOWN: a client component is unstyled in the first HTML (its rules are not sent)',
    },
  },
  {
    name: 'next-pages',
    port: 4103,
    filter: '@umber-fixtures/next-pages',
    routes,
    hasHtml: true,
    hasClientNavigation: true,
    sharesProcess: true,
    scenarios: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
    // One server process renders every request into the same cache, and the custom document extracts all
    // of it: once every page has been requested, each page carries the rules of the other two.
    known: {
      'E:home': KNOWN_SHARED_CACHE,
      'E:catalog': KNOWN_SHARED_CACHE,
      'E:settings': KNOWN_SHARED_CACHE,
    },
  },
  {
    name: 'spa',
    port: 4104,
    filter: '@umber-fixtures/spa',
    routes,
    hasHtml: false,
    hasClientNavigation: true,
    sharesProcess: false,
    scenarios: ['A', 'B', 'C', 'D', 'G'],
    known: {},
    only: 'spa.spec.ts',
  },
  {
    name: 'vue-ssr',
    port: 4105,
    filter: '@umber-fixtures/vue-ssr',
    routes,
    hasHtml: true,
    hasClientNavigation: true,
    sharesProcess: true,
    scenarios: ['A', 'B', 'C', 'D', 'F'],
    known: {},
  },
]

export const fixtureByName = (name: string): FixtureConfig => {
  const found = fixtures.find((fixture) => fixture.name === name)
  if (!found) throw new Error(`No fixture named ${name}`)
  return found
}
