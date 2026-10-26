import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { setGlobalLocale, useLocale } from '@/lib/hooks/useLocale'

describe('useLocale hook', () => {
  beforeEach(() => {
    localStorage.clear()
    setGlobalLocale('es')
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('defaults to Spanish (es-ES) as the primary product locale', () => {
    const { result } = renderHook(() => useLocale())
    expect(result.current.locale).toBe('es')
    expect(result.current.t('header.subtitle')).toBe(
      'Generación CAD paramétrica con validación de malla',
    )
  })

  it('switches to English when setLocale is invoked', () => {
    const { result } = renderHook(() => useLocale())

    act(() => {
      result.current.setLocale('en')
    })

    expect(result.current.locale).toBe('en')
    expect(result.current.t('header.subtitle')).toBe(
      'Parametric CAD generation with mesh validation',
    )
    expect(localStorage.getItem('nain_locale')).toBe('en')
  })

  it('synchronizes dynamically when a window nain:locale-change event is dispatched', () => {
    const { result } = renderHook(() => useLocale())

    act(() => {
      window.dispatchEvent(
        new CustomEvent('nain:locale-change', { detail: { locale: 'en' } }),
      )
    })

    expect(result.current.locale).toBe('en')

    act(() => {
      window.dispatchEvent(
        new CustomEvent('nain:locale-change', { detail: { locale: 'es' } }),
      )
    })

    expect(result.current.locale).toBe('es')
  })
})
