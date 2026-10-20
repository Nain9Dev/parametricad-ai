// @req REQ-UBI-16
// @req REQ-UBI-17
// @req REQ-UBI-18
import type { Page } from '@playwright/test'

import { expect, test } from './support/fixtures.ts'
import { openApp, PRESETS, presetCard, tab } from './support/app.ts'
import { auditText, findClippedContent, MINIMUM_TEXT_PX } from './support/audit.ts'

interface ViewportCase {
  name: string
  width: number
  height: number
}

/** The six viewports of spec 001, so legibility is held where the layout is. */
const VIEWPORTS: readonly ViewportCase[] = [
  { name: '320 x 568', width: 320, height: 568 },
  { name: '360 x 640', width: 360, height: 640 },
  { name: '375 x 812', width: 375, height: 812 },
  { name: '812 x 375', width: 812, height: 375 },
  { name: '768 x 1024', width: 768, height: 1024 },
  { name: '1280 x 800', width: 1280, height: 800 },
]

/** From here the three columns stand side by side and the tabs are gone. */
const WIDE_FROM_PX = 1024

const TABS = ['Presets', 'Parameters', 'Describe', 'Report'] as const

/** Text under the floor or under AA contrast in what is on screen now, tagged with where. */
async function legibility(page: Page, state: string, within?: string): Promise<string[]> {
  const { small, lowContrast } = await auditText(page, within === undefined ? {} : { within })
  return [...small, ...lowContrast].map((problem) => `${state}: ${problem}`)
}

/** Content that does not fit its card, for all five showcase cards. */
async function cardProblems(page: Page, state: string): Promise<string[]> {
  const cards = [
    ...PRESETS.map((preset) => presetCard(page, preset)),
    page.getByRole('button', { name: /Prompt IA/ }),
  ]
  const problems: string[] = []
  for (const card of cards) {
    problems.push(...(await findClippedContent(card)).map((problem) => `${state}: ${problem}`))
  }
  return problems
}

for (const viewport of VIEWPORTS) {
  test.describe(`REQ-UBI-16, REQ-UBI-17 and REQ-UBI-18 at ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test('every text is large and contrasting enough, and each card holds its content', async ({
      page,
    }) => {
      await openApp(page)
      const problems: string[] = []

      if (viewport.width >= WIDE_FROM_PX) {
        problems.push(...(await legibility(page, 'wide, parameters')))
        problems.push(...(await cardProblems(page, 'wide')))
        await page.getByRole('radio', { name: 'Description' }).click()
        problems.push(...(await legibility(page, 'wide, description')))
      } else {
        for (const name of TABS) {
          await tab(page, new RegExp(`^${name}`)).click()
          await expect(tab(page, new RegExp(`^${name}`))).toHaveAttribute('aria-selected', 'true')
          problems.push(...(await legibility(page, `${name} tab`)))
          if (name === 'Presets') problems.push(...(await cardProblems(page, 'Presets tab')))
        }
        await page.getByRole('button', { name: 'View options' }).click()
        await expect(page.getByRole('dialog', { name: 'View options' })).toBeVisible()
        problems.push(...(await legibility(page, 'View sheet', 'dialog[open]')))
      }

      expect(problems, `text under ${MINIMUM_TEXT_PX} px, under AA contrast, or cut off`).toEqual([])
    })
  })
}
