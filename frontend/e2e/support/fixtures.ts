import { expect, test as base } from '@playwright/test'

import { API_ORIGIN_PATTERN } from './env.ts'

/**
 * The naindev ecosystem bar, reduced to what matters for layout: a custom element
 * fixed to the top edge, 38 px high, above everything else (the height of the
 * script pinned in `index.html`, `?v=2.1.0`). Its box style sits in the shadow
 * root's `:host` rule, which loses to the page's own `display: none` the way the
 * real bar's does.
 */
const ECOSYSTEM_BAR_SCRIPT = `
class NainEcosystemBar extends HTMLElement {
  constructor() {
    super()
    const root = this.attachShadow({ mode: 'open' })
    root.innerHTML =
      '<style>:host{position:fixed;top:0;left:0;right:0;height:38px;display:block;' +
      'z-index:2147483647;box-sizing:border-box;padding:0 12px;background:#10131a;' +
      'border-bottom:1px solid #2a3140;color:#9aa5b6;font:12px/38px system-ui,sans-serif}</style>' +
      'naindev'
  }
}
customElements.define('nain-ecosystem-bar', NainEcosystemBar)
`

interface Fixtures {
  /** Keeps every test off the network and fails it on an uncaught page error. */
  isolation: undefined
}

export const test = base.extend<Fixtures>({
  isolation: [
    async ({ context, page }, provide) => {
      // Third parties are stubbed, and the generation service is unreachable
      // unless a test says otherwise: the suite needs no backend and no internet.
      await context.route(/^https:\/\/www\.naindev\.com\//, (route) =>
        route.fulfill({ contentType: 'text/javascript', body: ECOSYSTEM_BAR_SCRIPT }),
      )
      await context.route(/^https:\/\/brand\.naindev\.com\//, (route) =>
        route.fulfill({ contentType: 'text/css', body: '' }),
      )
      await context.route(API_ORIGIN_PATTERN, (route) => route.abort('connectionrefused'))

      const pageErrors: string[] = []
      page.on('pageerror', (error) => pageErrors.push(error.message))

      await provide(undefined)

      expect(pageErrors, 'uncaught errors in the page').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
