import type { APIRequestContext } from '@playwright/test'
import type { FixtureConfig } from '../fixtures'
import { PAGE_NAMES, waitForHydrated, writeReport } from '../helpers/navigation'
import { collectUnusedRules } from '../helpers/rules'
import { scenario, test, expect } from '../helpers/test'

// Scenario E: on landing, the engine's style holds no rule that the page does not use. The first test
// of each page measures and writes the numbers; the second asserts zero. A fixture that renders
// several pages in one process fails the second today (see `known` in fixtures.ts).
// A server process that renders every request into one cache has rendered every page by the time a
// real visitor lands on any of them: the measurement is made in that state, not in a lucky order.
async function warmUp(request: APIRequestContext, fixture: FixtureConfig) {
  if (!fixture.sharesProcess) return
  for (const name of PAGE_NAMES) await request.get(fixture.routes[name])
}

for (const name of PAGE_NAMES) {
  test(`E: measure the unused engine rules on landing at ${name}`, async ({
    page,
    request,
    fixture,
  }, info) => {
    scenario('E', fixture, info, 'E-measure')
    await warmUp(request, fixture)
    const report = await collectUnusedRules(page, async () => {
      await page.goto(fixture.routes[name])
      await waitForHydrated(page)
    })
    const numbers = {
      page: name,
      rulesTotal: report.total,
      rulesUnused: report.unused.length,
      bytesTotal: report.bytesTotal,
      bytesUnused: report.bytesUnused,
      ignored: report.ignored,
      unusedExamples: report.unused.slice(0, 5).map((rule) => rule.text.slice(0, 100)),
    }
    info.annotations.push({ type: 'unused rules', description: JSON.stringify(numbers) })
    writeReport(`unused-${fixture.name}-${name}.json`, numbers)
    expect(report.total, 'the tracking saw the engine rules').toBeGreaterThan(5)
  })

  test(`E: no unused engine rule on landing at ${name}`, async ({
    page,
    request,
    fixture,
  }, info) => {
    scenario('E', fixture, info, `E:${name}`)
    await warmUp(request, fixture)
    const report = await collectUnusedRules(page, async () => {
      await page.goto(fixture.routes[name])
      await page.getByTestId(`page-${name}`).waitFor()
      await waitForHydrated(page)
    })
    expect(report.total, 'the tracking saw the engine rules').toBeGreaterThan(5)
    expect(
      report.unused.map((rule) => rule.text.slice(0, 80)),
      `${report.unused.length} of ${report.total} rules unused, ${report.bytesUnused} of ${report.bytesTotal} bytes`
    ).toEqual([])
  })
}
