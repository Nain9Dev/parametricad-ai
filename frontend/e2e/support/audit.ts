import type { Locator, Page } from '@playwright/test'

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

/** The smallest text REQ-UBI-17 allows, in CSS pixels. */
export const MINIMUM_TEXT_PX = 12

/** WCAG 2.2 level AA: text below 24 px (18.66 px when bold), and large text (REQ-UBI-16). */
const CONTRAST_NORMAL = 4.5
const CONTRAST_LARGE = 3

export interface TextAudit {
  /** Text drawn under `MINIMUM_TEXT_PX`. */
  small: string[]
  /** Text whose colour over its background is under AA. */
  lowContrast: string[]
}

interface TextAuditOptions {
  /** Audit only what sits inside this selector, such as an open dialog. */
  within?: string
}

/**
 * The size and the contrast of every text that is drawn.
 *
 * The contrast is the WCAG 2 ratio of the computed text colour over the colour
 * the element sits on, taken from the nearest ancestors that paint a background
 * and laid over the page's own. Disabled controls are exempt, as WCAG exempts
 * them, and so are elements that fade (opacity under 1). The ecosystem bar is a
 * third-party script and is not audited. Text over the 3D canvas has no single
 * background and is not audited either.
 */
export async function auditText(
  page: Page,
  { within = 'body' }: TextAuditOptions = {},
): Promise<TextAudit> {
  return page.evaluate(
    ({ within, minimumPx, normal, large }) => {
      const root = document.querySelector(within)
      if (!root) return { small: [`nothing matches "${within}"`], lowContrast: [] }

      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('A 2D canvas is needed to read colours.')

      type Colour = [number, number, number, number]
      // The canvas turns any CSS colour (including the modern syntaxes Tailwind emits) into
      // bytes. A page uses a few dozen distinct colours, so each is read once.
      const known = new Map<string, Colour>()
      const toColour = (css: string): Colour => {
        const cached = known.get(css)
        if (cached) return cached
        context.clearRect(0, 0, 1, 1)
        context.fillStyle = '#000'
        context.fillStyle = css
        context.fillRect(0, 0, 1, 1)
        const data = context.getImageData(0, 0, 1, 1).data
        const colour: Colour = [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0, (data[3] ?? 0) / 255]
        known.set(css, colour)
        return colour
      }
      const over = (top: Colour, bottom: Colour): Colour => {
        const alpha = top[3]
        return [
          top[0] * alpha + bottom[0] * (1 - alpha),
          top[1] * alpha + bottom[1] * (1 - alpha),
          top[2] * alpha + bottom[2] * (1 - alpha),
          1,
        ]
      }
      const linear = (value: number): number => {
        const scaled = value / 255
        return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
      }
      const luminance = (colour: Colour): number =>
        0.2126 * linear(colour[0]) + 0.7152 * linear(colour[1]) + 0.0722 * linear(colour[2])
      const ratio = (first: Colour, second: Colour): number => {
        const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a) as [number, number]
        return (lighter + 0.05) / (darker + 0.05)
      }

      const page = toColour(getComputedStyle(document.body).backgroundColor)
      const pageBase: Colour = page[3] > 0 ? over(page, [255, 255, 255, 1]) : [255, 255, 255, 1]
      // What an element sits on: its own fill over what its parent sits on, up to an opaque one.
      const settled = new Map<Element, Colour>()
      const backgroundOf = (element: Element): Colour => {
        const cached = settled.get(element)
        if (cached) return cached
        const own = toColour(getComputedStyle(element).backgroundColor)
        let result: Colour
        if (own[3] >= 1) result = own
        else {
          const below = element.parentElement ? backgroundOf(element.parentElement) : pageBase
          result = own[3] <= 0 ? below : over(own, below)
        }
        settled.set(element, result)
        return result
      }
      const fades = (element: Element): boolean => {
        for (let node: Element | null = element; node; node = node.parentElement) {
          if (Number(getComputedStyle(node).opacity) < 1) return true
        }
        return false
      }
      const describe = (element: Element): string =>
        `"${(element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)}" (<${element.tagName.toLowerCase()}>)`

      const drawn = [...root.querySelectorAll('*')].filter((element) => {
        if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(element.tagName)) return false
        if (element.closest('nain-ecosystem-bar')) return false
        const style = getComputedStyle(element)
        if (style.display === 'none' || style.visibility === 'hidden') return false
        const box = element.getBoundingClientRect()
        if (box.width <= 1 || box.height <= 1) return false
        return [...element.childNodes].some(
          (child) => child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim() !== '',
        )
      })

      const small = new Set<string>()
      const lowContrast = new Set<string>()
      for (const element of drawn) {
        const style = getComputedStyle(element)
        const px = parseFloat(style.fontSize)
        if (px < minimumPx - 0.01) small.add(`${describe(element)} is ${px} px`)

        if (element.closest(':disabled, [aria-disabled="true"]') || fades(element)) continue
        if (element.closest('main')?.querySelector('canvas')?.parentElement?.contains(element)) continue

        const background = backgroundOf(element)
        const own = toColour(style.color)
        const text = own[3] < 1 ? over(own, background) : own
        const weight = parseInt(style.fontWeight, 10) || 400
        const isLarge = px >= 24 || (px >= 18.66 && weight >= 700)
        const needed = isLarge ? large : normal
        const found = ratio(text, background)
        if (found < needed) {
          lowContrast.add(`${describe(element)} is ${found.toFixed(2)}:1, needs ${needed}:1`)
        }
      }
      return { small: [...small], lowContrast: [...lowContrast] }
    },
    { within, minimumPx: MINIMUM_TEXT_PX, normal: CONTRAST_NORMAL, large: CONTRAST_LARGE },
  )
}

/**
 * Content that does not fit the card that holds it (REQ-UBI-18).
 *
 * Three ways to fail: a piece of text leaves the card's box, a clamped or
 * ellipsised text is cut, or two pieces of text overlap. The card is the
 * element given; text inside it is every descendant with its own text node.
 */
export async function findClippedContent(card: Locator): Promise<string[]> {
  return card.evaluate((element, tolerance) => {
    const describe = (node: Element): string =>
      `"${(node.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`
    const own = (node: Element): boolean =>
      [...node.childNodes].some(
        (child) => child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim() !== '',
      )

    const offenders: string[] = []
    const card = element.getBoundingClientRect()
    const pieces = [...element.querySelectorAll('*')].filter((node) => {
      const box = node.getBoundingClientRect()
      return own(node) && box.width > 1 && box.height > 1
    })

    for (const piece of pieces) {
      const box = piece.getBoundingClientRect()
      const outside = Math.max(
        card.left - box.left,
        box.right - card.right,
        card.top - box.top,
        box.bottom - card.bottom,
      )
      if (outside > tolerance) offenders.push(`${describe(piece)} leaves its card by ${Math.round(outside)} px`)

      const style = getComputedStyle(piece)
      const clamped =
        (style.webkitLineClamp !== '' && style.webkitLineClamp !== 'none') ||
        style.textOverflow === 'ellipsis'
      if (clamped && (piece.scrollWidth > piece.clientWidth + 1 || piece.scrollHeight > piece.clientHeight + 1)) {
        offenders.push(`${describe(piece)} is cut off`)
      }
    }

    for (const [index, first] of pieces.entries()) {
      for (const second of pieces.slice(index + 1)) {
        if (first.contains(second) || second.contains(first)) continue
        const a = first.getBoundingClientRect()
        const b = second.getBoundingClientRect()
        const across = Math.min(a.right, b.right) - Math.max(a.left, b.left)
        const down = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        if (across > 1 && down > 1) offenders.push(`${describe(first)} overlaps ${describe(second)}`)
      }
    }

    if (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1) {
      offenders.push('the card scrolls its own content')
    }
    return offenders
  }, ROUNDING_TOLERANCE_PX)
}
