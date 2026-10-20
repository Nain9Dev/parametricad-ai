import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PwaStatus } from '@/components/layout/PwaStatus'

// @req REQ-EVT-07

const controller = vi.hoisted(() => ({
  updateReady: false,
  offlineReady: false,
  applyUpdate: vi.fn(),
  dismissUpdate: vi.fn(),
  dismissOfflineReady: vi.fn(),
}))

vi.mock('@/lib/hooks/usePwaUpdate', () => ({ usePwaUpdate: () => controller }))

beforeEach(() => {
  controller.updateReady = false
  controller.offlineReady = false
  controller.applyUpdate.mockClear()
  controller.dismissUpdate.mockClear()
  controller.dismissOfflineReady.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('PwaStatus', () => {
  it('keeps an empty live region ready, so a later message is announced', () => {
    render(<PwaStatus />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('announces a new version without applying it', () => {
    controller.updateReady = true
    render(<PwaStatus />)

    expect(screen.getByRole('status')).toHaveTextContent('A new version is available.')
    expect(controller.applyUpdate).not.toHaveBeenCalled()
  })

  it('applies the update only when the user chooses Reload', () => {
    controller.updateReady = true
    render(<PwaStatus />)

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))

    expect(controller.applyUpdate).toHaveBeenCalledTimes(1)
    expect(controller.dismissUpdate).not.toHaveBeenCalled()
  })

  it('puts the update off when the user chooses Later, without reloading', () => {
    controller.updateReady = true
    render(<PwaStatus />)

    fireEvent.click(screen.getByRole('button', { name: 'Later' }))

    expect(controller.dismissUpdate).toHaveBeenCalledTimes(1)
    expect(controller.applyUpdate).not.toHaveBeenCalled()
  })

  it('says once that the app is ready to work offline', () => {
    controller.offlineReady = true
    render(<PwaStatus />)

    expect(screen.getByRole('status')).toHaveTextContent('Ready to work offline.')
  })

  it('lets the user dismiss the offline notice', () => {
    controller.offlineReady = true
    render(<PwaStatus />)

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(controller.dismissOfflineReady).toHaveBeenCalledTimes(1)
  })

  it('lets the offline notice go on its own after a few seconds', () => {
    vi.useFakeTimers()
    controller.offlineReady = true
    render(<PwaStatus />)
    expect(controller.dismissOfflineReady).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(6_000)
    })

    expect(controller.dismissOfflineReady).toHaveBeenCalledTimes(1)
  })

  it('never dismisses a waiting update by itself', () => {
    vi.useFakeTimers()
    controller.updateReady = true
    render(<PwaStatus />)

    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(controller.dismissUpdate).not.toHaveBeenCalled()
  })
})
