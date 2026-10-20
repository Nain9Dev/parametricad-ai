import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppHeader } from '@/components/layout/AppHeader'

// @req REQ-STA-04
// @req REQ-EVT-06

const device = vi.hoisted(() => ({
  online: true,
  install: { canInstall: false, showIosHint: false, promptInstall: vi.fn() },
}))

vi.mock('@/lib/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => device.online }))
vi.mock('@/lib/hooks/useInstallPrompt', () => ({ useInstallPrompt: () => device.install }))
// The health check never settles: these tests are about what the header shows
// for the device, not about the service.
vi.mock('@/lib/apiClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/apiClient')>()),
  fetchHealth: () => new Promise(() => undefined),
}))

beforeEach(() => {
  device.online = true
  device.install.canInstall = false
  device.install.showIosHint = false
  device.install.promptInstall.mockReset()
})

describe('AppHeader and the connection', () => {
  it('shows the service badge while the device is online', () => {
    render(<AppHeader />)

    expect(screen.getByText('24/7 Demo Activa')).toBeInTheDocument()
    expect(screen.queryByText('Offline')).not.toBeInTheDocument()
  })

  it('shows Offline instead of the service badge while the device is offline', () => {
    device.online = false
    render(<AppHeader />)

    expect(screen.getByRole('status')).toHaveTextContent('Offline')
    expect(screen.queryByText('24/7 Demo Activa')).not.toBeInTheDocument()
  })
})

describe('AppHeader and installation', () => {
  it('has no Install control until the browser offers installation', () => {
    render(<AppHeader />)
    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument()
  })

  it('opens the browser prompt from the Install control', () => {
    device.install.canInstall = true
    render(<AppHeader />)

    fireEvent.click(screen.getByRole('button', { name: 'Install app' }))

    expect(device.install.promptInstall).toHaveBeenCalledTimes(1)
  })

  it('offers the Add to Home Screen explanation on iOS', () => {
    device.install.showIosHint = true
    render(<AppHeader />)

    fireEvent.click(screen.getByRole('button', { name: 'Install app' }))

    expect(screen.getByRole('dialog', { name: 'Install ParametriCAD' })).toBeInTheDocument()
  })
})
