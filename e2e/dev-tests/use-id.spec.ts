import { loadPage } from '../helpers/navigation'
import { expect, test } from '../helpers/dev'

// Scenario N in development: the browser makes the id of `useId` that the server wrote, under a styled
// element given a plain object in `style`. The `messages` fixture fails the test on the warning that
// React prints in development when they differ.
test('use id: an id of useId under a styled element given a style object is the one the server wrote', async ({
  page,
  fixture,
}) => {
  await loadPage(page, fixture, 'home')
  const probe = page.getByTestId('id-probe')
  await expect(probe).toHaveAttribute('data-browser-id', /.+/)
  const { written, made } = await probe.evaluate((element: HTMLElement) => ({
    written: element.id,
    made: element.dataset.browserId,
  }))
  expect(made, 'the id the browser made').toBe(written)
})
