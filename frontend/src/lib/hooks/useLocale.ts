import { useSyncExternalStore } from 'react'
import { TRANSLATIONS, type Locale, type TranslationKey } from '@/lib/i18n'

function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'es'
  try {
    const val = localStorage.getItem('nain_locale')
    if (val === 'en' || val === 'es') return val
  } catch {
    // Local storage restricted
  }
  return 'es'
}

let currentLocale: Locale = getStoredLocale()
const listeners = new Set<() => void>()

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

function notify() {
  for (const listener of listeners) {
    listener()
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('nain:locale-change', ((event: CustomEvent<{ locale: Locale }>) => {
    if (event.detail?.locale && event.detail.locale !== currentLocale) {
      currentLocale = event.detail.locale
      notify()
    }
  }) as EventListener)

  window.addEventListener('storage', (event) => {
    if (event.key === 'nain_locale' && (event.newValue === 'es' || event.newValue === 'en')) {
      currentLocale = event.newValue
      notify()
    }
  })
}

export function setGlobalLocale(locale: Locale): void {
  if (locale !== 'es' && locale !== 'en') return
  if (currentLocale === locale) return
  currentLocale = locale
  try {
    localStorage.setItem('nain_locale', locale)
  } catch {
    // Local storage restricted
  }
  notify()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nain:locale-change', { detail: { locale } }))
  }
}

export function useLocale() {
  const locale = useSyncExternalStore<Locale>(subscribe, () => currentLocale, () => 'es')

  const t = (key: TranslationKey): string => {
    const catalog = TRANSLATIONS[locale] ?? TRANSLATIONS.es
    return catalog[key] ?? TRANSLATIONS.es[key] ?? key
  }

  return {
    locale,
    setLocale: setGlobalLocale,
    t,
  }
}
