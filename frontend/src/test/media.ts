/**
 * A stand-in for `window.matchMedia`, which jsdom does not implement.
 *
 * `matching` lists the exact queries that should report a match; every other
 * query reports none. Nothing ever changes afterwards, which is all the tests
 * that use it need. `useMediaQuery.test.ts` drives change events itself.
 */
export function stubMatchMedia(matching: readonly string[] = []): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: matching.includes(query),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  })
}

export function restoreMatchMedia(): void {
  Reflect.deleteProperty(window, 'matchMedia')
}
