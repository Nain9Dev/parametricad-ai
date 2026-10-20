// @req REQ-UBI-12
import { expect, test } from './support/fixtures.ts'
import { openApp } from './support/app.ts'

// The viewer needs WebGL, and a hosted runner has no GPU, so this is where a
// missing software renderer shows up once and clearly (ADR-0009, decision 7).
// The other specs wait for it.
test('WebGL2 is available and the viewer draws the first part', async ({ page }) => {
  await page.goto('about:blank')
  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2')
    if (!gl) return null
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    return String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
  })
  expect(renderer, 'a WebGL2 context').not.toBeNull()
  await test.info().attach('webgl-renderer', { body: String(renderer), contentType: 'text/plain' })

  await openApp(page)
  await expect(page.locator('main canvas')).toBeVisible()
  await expect(page.getByText('The 3D view stopped')).toHaveCount(0)
})
