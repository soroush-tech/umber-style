import { PAGE_NAMES, writeReport } from '../helpers/navigation'
import { runLighthouse } from '../helpers/lighthouse'
import { scenario, test, expect } from '../helpers/test'

// Scenario G: a Lighthouse run of each page of the production build. The numbers go to a JSON report
// under e2e/reports; the assertions are generous limits that a healthy page meets with a wide margin.
for (const name of PAGE_NAMES) {
  test(`G: Lighthouse on ${name}`, async ({ fixture }, info) => {
    scenario('G', fixture, info)
    info.setTimeout(120_000)
    const numbers = await runLighthouse(`http://localhost:${fixture.port}${fixture.routes[name]}`)
    info.annotations.push({ type: 'lighthouse', description: JSON.stringify(numbers) })
    writeReport(`lighthouse-${fixture.name}-${name}.json`, {
      fixture: fixture.name,
      page: name,
      ...numbers,
    })
    expect(numbers.score, 'performance score').toBeGreaterThan(0.5)
    expect(numbers.totalBlockingTime, 'total blocking time in ms').toBeLessThan(1000)
    expect(numbers.transferBytes, 'transfer size in bytes').toBeLessThan(1_000_000)
  })
}
