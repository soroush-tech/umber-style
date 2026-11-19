import type { NextConfig } from 'next'

const config: NextConfig = {
  // The workspace packages export TypeScript source: Next compiles them with the app.
  transpilePackages: ['@umber-fixtures/shared', '@umber-style/react', '@umber-style/core'],
  // The production build is what the tests run against.
  reactStrictMode: true,
}

export default config
