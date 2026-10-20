import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { InstallButton } from '@/components/layout/InstallButton'

// @req REQ-EVT-06

describe('InstallButton', () => {
  it('renders nothing when there is nothing to install or explain', () => {
    const { container } = render(
      <InstallButton canInstall={false} showIosHint={false} onInstall={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('opens the browser prompt when the browser has offered installation', () => {
    const onInstall = vi.fn()
    render(<InstallButton canInstall showIosHint={false} onInstall={onInstall} />)

    fireEvent.click(screen.getByRole('button', { name: 'Install app' }))

    expect(onInstall).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the visible label Install, which the accessible name contains', () => {
    render(<InstallButton canInstall showIosHint={false} onInstall={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Install app' })).toHaveTextContent('Install')
  })

  it('explains Add to Home Screen on iOS instead of calling a prompt', () => {
    const onInstall = vi.fn()
    render(<InstallButton canInstall={false} showIosHint onInstall={onInstall} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Install app' }))

    const hint = screen.getByRole('dialog', { name: 'Install ParametriCAD' })
    expect(hint).toHaveTextContent('Share')
    expect(hint).toHaveTextContent('Add to Home Screen')
    expect(onInstall).not.toHaveBeenCalled()
  })

  it('closes the iOS explanation', () => {
    render(<InstallButton canInstall={false} showIosHint onInstall={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Install app' }))

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('prefers the browser prompt when both are possible', () => {
    const onInstall = vi.fn()
    render(<InstallButton canInstall showIosHint onInstall={onInstall} />)

    fireEvent.click(screen.getByRole('button', { name: 'Install app' }))

    expect(onInstall).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
