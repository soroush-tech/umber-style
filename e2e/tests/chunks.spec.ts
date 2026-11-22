import { CHUNKS_SCENARIOS } from '../helpers/chunks'
import { test } from '../helpers/test'

// The page of the Vike fixture rendered with the cache and server packages, on its production build
// (see helpers/chunks.ts). The development tier runs the same checks in dev-tests/chunks.spec.ts.
for (const scenario of CHUNKS_SCENARIOS) {
  test(`chunks: ${scenario.title}`, async ({ page, browser, request, fixture }, info) => {
    info.skip(fixture.name !== 'vike-ssg', 'the page of chunks is in the Vike fixture')
    await scenario.run(page, { browser, request, fixture })
  })
}
