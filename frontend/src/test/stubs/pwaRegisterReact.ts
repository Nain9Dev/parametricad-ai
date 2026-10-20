/**
 * Stand-in for `virtual:pwa-register/react`, a module the PWA plugin generates
 * at build time and that does not exist under Vitest. Tests that care about the
 * update flow replace it with `vi.mock`.
 */
export function useRegisterSW() {
  return {
    needRefresh: [false, () => undefined] as const,
    offlineReady: [false, () => undefined] as const,
    updateServiceWorker: () => Promise.resolve(),
  }
}
