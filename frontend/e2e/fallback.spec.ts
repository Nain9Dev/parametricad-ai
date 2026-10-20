// @req REQ-UNW-04
import { expect, test } from './support/fixtures.ts'
import { boundingBox, FLANGE, openApp, PRESETS, presetCard, tab } from './support/app.ts'

const ELBOW = PRESETS[1]

const LAYOUTS = [
  { name: 'wide layout', viewport: { width: 1280, height: 800 }, compact: false },
  { name: 'compact layout', viewport: { width: 375, height: 812 }, compact: true },
] as const

// The service is unreachable in every spec (see the fixtures), which is exactly
// the situation REQ-UNW-04 is about: a bundled part may answer only for the
// request it was built from, and never in place of a different one.
for (const layout of LAYOUTS) {
  test.describe(`REQ-UNW-04 in the ${layout.name}`, () => {
    test.use({ viewport: layout.viewport })

    test('an edit the service cannot answer keeps the previous model and says a connection is needed', async ({
      page,
    }) => {
      await openApp(page)
      if (layout.compact) await tab(page, /^Parameters/).click()

      const diameter = page.getByLabel('Outer diameter', { exact: true })
      await expect(diameter).toHaveValue('100')
      await diameter.fill('150')

      // The notice is where the user is looking: the viewer when compact, the
      // Report column otherwise. Either way it offers another try.
      const notice = page.getByRole('alert').filter({ hasText: 'Could not reach the generation service.' })
      await expect(notice).toBeVisible()
      await expect(notice.getByRole('button', { name: 'Retry' })).toBeVisible()

      // The form keeps what was typed; the viewer keeps what was generated.
      await expect(diameter).toHaveValue('150')
      if (layout.compact) await tab(page, /^Report/).click()
      await expect(boundingBox(page)).toHaveText(FLANGE.box)
    })

    test('a specification equal to a bundled part is still answered, and clears the notice', async ({
      page,
    }) => {
      await openApp(page)
      if (layout.compact) await tab(page, /^Parameters/).click()

      const diameter = page.getByLabel('Outer diameter', { exact: true })
      await diameter.fill('150')
      const notice = page.getByRole('alert').filter({ hasText: 'Could not reach the generation service.' })
      await expect(notice).toBeVisible()

      // Back to 100 mm the form describes the bundled flange again.
      await diameter.fill('100')
      await expect(notice).toBeHidden()

      // And a card is a bundled specification by construction.
      if (layout.compact) await tab(page, /^Presets/).click()
      await presetCard(page, ELBOW).click()
      if (layout.compact) await tab(page, /^Report/).click()
      await expect(boundingBox(page)).toHaveText(ELBOW.box)
      await expect(notice).toBeHidden()
    })
  })
}
