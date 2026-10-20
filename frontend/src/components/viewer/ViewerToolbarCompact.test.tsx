import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ViewerToolbarCompact } from '@/components/viewer/ViewerToolbarCompact'
import { DEFAULT_VIEWER_OPTIONS, type ViewerOptions } from '@/components/viewer/viewerOptions'

// @req REQ-UBI-12

function renderToolbar(options: ViewerOptions = DEFAULT_VIEWER_OPTIONS) {
  const onChange = vi.fn()
  const onResetView = vi.fn()
  const onSelectOrientation = vi.fn()
  render(
    <ViewerToolbarCompact
      options={options}
      onChange={onChange}
      onResetView={onResetView}
      activeOrientation="iso"
      onSelectOrientation={onSelectOrientation}
      disabled={false}
    />,
  )
  return { onChange, onResetView, onSelectOrientation }
}

function openSheet() {
  fireEvent.click(screen.getByRole('button', { name: 'View options' }))
  return screen.getByRole('dialog', { name: 'View options' })
}

describe('ViewerToolbarCompact', () => {
  it('keeps the camera presets and Fit one tap away', () => {
    const { onResetView, onSelectOrientation } = renderToolbar()

    const iso = screen.getByRole('button', { name: 'Snap camera to ISO view' })
    expect(iso).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Snap camera to TOP view' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Snap camera to FRONT view' }))
    expect(onSelectOrientation).toHaveBeenCalledWith('front')

    fireEvent.click(screen.getByRole('button', { name: 'Fit camera to geometry bounds' }))
    expect(onResetView).toHaveBeenCalled()
  })

  it('does not show the secondary controls until View options is opened', () => {
    renderToolbar()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: 'Surface shading' })).not.toBeInTheDocument()

    const sheet = openSheet()
    expect(within(sheet).getByRole('radiogroup', { name: 'Surface shading' })).toBeInTheDocument()
    expect(within(sheet).getByRole('radiogroup', { name: 'Camera projection' })).toBeInTheDocument()
  })

  it('offers every display toggle with a visible label and its state', () => {
    renderToolbar()
    const sheet = openSheet()

    for (const label of [
      'Crease edges',
      'Wireframe',
      'Ground grid',
      'Axis gizmo',
      'Dimensions',
      'Section plane',
      'Caliper',
    ]) {
      expect(within(sheet).getByRole('button', { name: label })).toHaveAttribute('aria-pressed')
    }
    expect(within(sheet).getByRole('button', { name: 'Crease edges' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(sheet).getByRole('button', { name: 'Wireframe' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('applies a toggle to the shared viewer options', () => {
    const { onChange } = renderToolbar()
    const sheet = openSheet()

    fireEvent.click(within(sheet).getByRole('button', { name: 'Wireframe' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_VIEWER_OPTIONS, wireframe: true })
  })

  it('changes the shading mode from the sheet', () => {
    const { onChange } = renderToolbar()
    const sheet = openSheet()

    fireEvent.click(within(sheet).getByRole('radio', { name: 'Clay' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_VIEWER_OPTIONS, shadingMode: 'clay' })
  })

  it('shows the section controls inside the sheet once the section plane is on', () => {
    renderToolbar({ ...DEFAULT_VIEWER_OPTIONS, sectionPlane: true, sectionOffset: 0.25 })
    const sheet = openSheet()

    const slider = within(sheet).getByLabelText('Section cutting plane offset')
    expect(slider).toHaveAttribute('type', 'range')
    expect(slider).toHaveAttribute('aria-valuenow', '0.25')
    expect(within(sheet).getByText('+0.25')).toBeInTheDocument()
  })

  it('tells a touch user to tap, not click, when the caliper is on', () => {
    renderToolbar({ ...DEFAULT_VIEWER_OPTIONS, caliper: true })
    const sheet = openSheet()
    expect(within(sheet).getByText(/Tap 2 vertices/)).toBeInTheDocument()
  })

  it('drops the word View, not the button, on screens narrower than 360 px', () => {
    // Four presets, Fit and a labelled View need about 330 px; a 320 px phone has
    // 304 px to give them, so below 360 px the button keeps only its icon.
    renderToolbar()
    const button = screen.getByRole('button', { name: 'View options' })
    const label = within(button).getByText('View')

    expect(label).toHaveClass('hidden', 'min-[22.5rem]:inline')
    expect(button).toHaveClass('min-w-11')
  })

  it('closes the sheet from its Close button', () => {
    renderToolbar()
    openSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('disables the camera controls while there is no model, but not the view options', () => {
    render(
      <ViewerToolbarCompact
        options={DEFAULT_VIEWER_OPTIONS}
        onChange={vi.fn()}
        onResetView={vi.fn()}
        onSelectOrientation={vi.fn()}
        disabled
      />,
    )
    expect(screen.getByRole('button', { name: 'Fit camera to geometry bounds' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Snap camera to TOP view' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'View options' })).toBeEnabled()
  })
})
