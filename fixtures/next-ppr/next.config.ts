import type { NextConfig } from 'next'

const config: NextConfig = {
  // Partial prerendering: each route is prerendered at build time up to its `Suspense` boundaries that
  // wait for the request, and the rest streams in at request time. It is a switch of the whole app, so
  // it has a fixture of its own (node_modules/next/dist/docs/01-app/03-api-reference/05-config/
  // 01-next-config-js/cacheComponents.md). Partial prefetching is set, as the framework asks.
  cacheComponents: true,
  partialPrefetching: true,
  // The workspace packages export TypeScript source: Next compiles them with the app.
  transpilePackages: [
    '@umber-fixtures/shared',
    '@umber-style/react',
    '@umber-style/core',
    '@umber-style/cache',
    '@umber-style/is-prop-valid',
    'umber-style',
  ],
  reactStrictMode: true,
}

export default config
