import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { BottomSheet } from '@/components/ui/BottomSheet'

// @req REQ-UBI-12

function renderSheet(open: boolean, onClose = vi.fn()) {
  render(
    <BottomSheet open={open} onClose={onClose} title="View options">
      <button type="button">Inside</button>
    </BottomSheet>,
  )
  return onClose
}

describe('BottomSheet', () => {
  it('stays closed until it is opened', () => {
    renderSheet(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens as a modal dialog named by its title', () => {
    renderSheet(true)
    expect(screen.getByRole('dialog', { name: 'View options' })).toBeInTheDocument()
  })

  it('opens and closes the native dialog as the open prop changes', () => {
    const { rerender } = render(
      <BottomSheet open={false} onClose={vi.fn()} title="View options">
        <p>content</p>
      </BottomSheet>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    rerender(
      <BottomSheet open onClose={vi.fn()} title="View options">
        <p>content</p>
      </BottomSheet>,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    rerender(
      <BottomSheet open={false} onClose={vi.fn()} title="View options">
        <p>content</p>
      </BottomSheet>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes from its Close button', () => {
    const onClose = renderSheet(true)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('closes when the backdrop is pressed but not when its content is', () => {
    const onClose = renderSheet(true)

    fireEvent.click(screen.getByRole('button', { name: 'Inside' }))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('reports the native close event, which is what Escape raises', () => {
    const onClose = renderSheet(true)
    fireEvent(screen.getByRole('dialog'), new Event('close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
