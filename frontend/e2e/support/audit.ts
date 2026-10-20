import type { Page } from '@playwright/test'

/** The size REQ-UBI-13 asks of every control on a touch screen, in CSS pixels. */
export const MINIMUM_TARGET_PX = 44

/** Layout engines round boxes to fractions of a pixel; half a pixel is not a smaller target. */
const ROUNDING_TOLERANCE_PX = 0.5

interface TargetAuditOptions {
  /** Audit only what sits inside this selector, such as an open dialog. */
  within?: string
}

/**
 * Interactive controls smaller than 44 px in either direction.
 *
 * The same audit the manual check used: buttons, links, inputs, selects and the
 * ARIA widgets that stand in for them. A check box or radio inside a label is
 * pressed through the label, so the label is what gets measured. Controls that
 * are not drawn (hidden, or the 1 px visually-hidden kind) are not targets.
 * Controls scrolled out of view still count: they are one swipe away.
 */
export async function findSmallTargets(
  page: Page,
  { within = 'body' }: TargetAuditOptions = {},
): Promise<string[]> {
  return page.evaluate(
    ({ within, minimum, tolerance }) => {
      const interactive = [
        'a[href]',
        'button',
        'input:not([type="hidden"])',
        'select',
        'textarea',
        'summary',
        '[role="button"]',
        '[role="tab"]',
        '[role="radio"]',
        '[role="menuitem"]',
        '[role="checkbox"]',
        '[role="switch"]',
        '[role="slider"]',
      ].join(',')

      const name = (element: Element): string => {
        const text = element.getAttribute('aria-label') ?? element.textContent?.trim() ?? ''
        return `<${element.tagName.toLowerCase()}> "${text.slice(0, 40)}"`
      }

      const root = document.querySelector(within)
      if (!root) return [`nothing matches "${within}"`]

      const measured = new Set<Element>()
      const offenders: string[] = []
      for (const element of root.querySelectorAll(interactive)) {
        const pressedThroughLabel =
          element instanceof HTMLInputElement &&
          (element.type === 'checkbox' || element.type === 'radio')
        const target = (pressedThroughLabel ? element.closest('label') : null) ?? element
        if (measured.has(target)) continue
        measured.add(target)

        const style = getComputedStyle(target)
        const { width, height } = target.getBoundingClientRect()
        if (style.display === 'none' || style.visibility === 'hidden') continue
        if (width <= 1 || height <= 1) continue

        if (width < minimum - tolerance || height < minimum - tolerance) {
          offenders.push(`${name(target)} is ${width.toFixed(1)} x ${height.toFixed(1)} px`)
        }
      }
      return offenders
    },
    { within, minimum: MINIMUM_TARGET_PX, tolerance: ROUNDING_TOLERANCE_PX },
  )
}

/**
 * Boxes cut off by the edge of the screen.
 *
 * The shell clips its own overflow, so a control pushed past the edge does not
 * make the page scroll sideways: it is simply gone. This finds those. A box
 * inside an inner container that clips it (a progress bar sliding inside its
 * track) is that container's business and is skipped.
 */
export async function findClippedByViewportEdge(page: Page): Promise<string[]> {
  return page.evaluate((tolerance) => {
    const viewportWidth = document.documentElement.clientWidth
    const shell = document.getElementById('root')?.firstElementChild ?? null

    const name = (element: Element): string => {
      const text = element.getAttribute('aria-label') ?? element.textContent?.trim() ?? ''
      return `<${element.tagName.toLowerCase()}> "${text.slice(0, 40)}"`
    }

    const offenders: string[] = []
    for (const element of document.body.querySelectorAll('*')) {
      const style = getComputedStyle(element)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      const box = element.getBoundingClientRect()
      if (box.width <= 1 || box.height <= 1) continue
      if (box.left >= -tolerance && box.right <= viewportWidth + tolerance) continue

      let clippedByInnerContainer = false
      for (let parent = element.parentElement; parent && parent !== shell; parent = parent.parentElement) {
        if (getComputedStyle(parent).overflowX === 'visible') continue
        const container = parent.getBoundingClientRect()
        if (container.left >= -tolerance && container.right <= viewportWidth + tolerance) {
          clippedByInnerContainer = true
          break
        }
      }
      if (clippedByInnerContainer) continue

      offenders.push(
        `${name(element)} spans ${Math.round(box.left)} to ${Math.round(box.right)} of ${viewportWidth} px`,
      )
    }
    return offenders
  }, ROUNDING_TOLERANCE_PX)
}
