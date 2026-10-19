import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ViewerToolbar } from '@/components/viewer/ViewerToolbar'
import { DEFAULT_VIEWER_OPTIONS, type ViewerOptions } from '@/components/viewer/viewerOptions'

describe('ViewerToolbar Accessibility & Deterministic Feedback', () => {
  it('renders section plane controls with accessible name, range bounds, and numeric readout', () => {
    const options: ViewerOptions = {
      ...DEFAULT_VIEWER_OPTIONS,
      sectionPlane: true,
      sectionOffset: 0.25,
    }

    render(
      <ViewerToolbar
        options={options}
        onChange={vi.fn()}
        onResetView={vi.fn()}
        disabled={false}
      />,
    )

    const slider = screen.getByLabelText('Section cutting plane offset')
    expect(slider).toBeInTheDocument()
    expect(slider).toHaveAttribute('type', 'range')
    expect(slider).toHaveAttribute('min', '-0.95')
    expect(slider).toHaveAttribute('max', '0.95')
    expect(slider).toHaveAttribute('aria-valuenow', '0.25')

    // Formatted feedback readout
    expect(screen.getByText('+0.25')).toBeInTheDocument()
  })

  it('provides accessible camera orientation controls with aria-pressed state', () => {
    render(
      <ViewerToolbar
        options={DEFAULT_VIEWER_OPTIONS}
        onChange={vi.fn()}
        onResetView={vi.fn()}
        activeOrientation="iso"
        onSelectOrientation={vi.fn()}
        disabled={false}
      />,
    )

    const isoButton = screen.getByRole('button', { name: 'Snap camera to ISO view' })
    const topButton = screen.getByRole('button', { name: 'Snap camera to TOP view' })

    expect(isoButton).toHaveAttribute('aria-pressed', 'true')
    expect(topButton).toHaveAttribute('aria-pressed', 'false')
  })

  it('renders fit button with an explicit accessible description', () => {
    render(
      <ViewerToolbar
        options={DEFAULT_VIEWER_OPTIONS}
        onChange={vi.fn()}
        onResetView={vi.fn()}
        disabled={false}
      />,
    )

    const fitButton = screen.getByRole('button', { name: 'Fit camera to geometry bounds' })
    expect(fitButton).toBeInTheDocument()
  })
})
