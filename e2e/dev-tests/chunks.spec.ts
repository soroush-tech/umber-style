import { CHUNKS_SCENARIOS } from '../helpers/chunks'
import { test } from '../helpers/dev'

// The page of the Vike fixture rendered with the cache and server packages, on its development server
// (see helpers/chunks.ts).
for (const scenario of CHUNKS_SCENARIOS) {
  test(`chunks: ${scenario.title}`, async ({ page, browser, request, fixture }, info) => {
    info.skip(fixture.name !== 'vike-ssg', 'the page of chunks is in the Vike fixture')
    await scenario.run(page, {
      browser,
      request,
      fixture: { ...fixture, port: fixture.devPort as number },
    })
  })
}
