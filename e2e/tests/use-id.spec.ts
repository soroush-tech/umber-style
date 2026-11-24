import { loadPage } from '../helpers/navigation'
import { requireScenario, test, expect } from '../helpers/test'

// Scenario N: an id of `useId` under a styled element given a plain object in `style`. The browser makes
// the id the server wrote: React's `useId` reads the shape of the tree, so the server and the browser
// render the same one. A production build of React does not warn when they differ and keeps the attribute
// of the server, so the probe writes the id the browser made into `data-browser-id`.
test('N: an id of useId under a styled element given a style object is the one the server wrote', async ({
  page,
  fixture,
}, info) => {
  requireScenario('N', fixture, info)
  await loadPage(page, fixture, 'home')
  const probe = page.getByTestId('id-probe')
  await expect(probe).toHaveAttribute('data-browser-id', /.+/)
  const { written, made } = await probe.evaluate((element: HTMLElement) => ({
    written: element.id,
    made: element.dataset.browserId,
  }))
  expect(written).not.toBe('')
  expect(made, 'the id the browser made').toBe(written)
})
