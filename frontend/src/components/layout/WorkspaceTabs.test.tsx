import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { WorkspaceTabs } from '@/components/layout/WorkspaceTabs'
import {
  WORKSPACE_TABS,
  workspacePanelId,
  workspaceTabId,
} from '@/components/layout/workspaceSections'

// @req REQ-UBI-12

function renderTabs(
  props: Partial<Parameters<typeof WorkspaceTabs>[0]> = {},
  onChange = vi.fn(),
) {
  render(<WorkspaceTabs value="presets" onChange={onChange} {...props} />)
  return onChange
}

describe('WorkspaceTabs', () => {
  it('offers the four workspace sections in order inside one tablist', () => {
    renderTabs()
    const tablist = screen.getByRole('tablist', { name: 'Workspace sections' })
    expect(tablist).toBeInTheDocument()
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent?.trim())).toEqual([
      'Presets',
      'Parameters',
      'Describe',
      'Report',
    ])
    expect(WORKSPACE_TABS.map((tab) => tab.id)).toEqual([
      'presets',
      'parameters',
      'describe',
      'report',
    ])
  })

  it('marks the selected tab and keeps only it in the tab order', () => {
    renderTabs({ value: 'describe' })
    const selected = screen.getByRole('tab', { name: 'Describe' })
    expect(selected).toHaveAttribute('aria-selected', 'true')
    expect(selected).toHaveAttribute('tabindex', '0')
    expect(selected).toHaveAttribute('aria-controls', workspacePanelId('describe'))
    expect(selected).toHaveAttribute('id', workspaceTabId('describe'))

    const other = screen.getByRole('tab', { name: 'Presets' })
    expect(other).toHaveAttribute('aria-selected', 'false')
    expect(other).toHaveAttribute('tabindex', '-1')
    expect(other).not.toHaveAttribute('aria-controls')
  })

  it('selects a tab on click', () => {
    const onChange = renderTabs()
    fireEvent.click(screen.getByRole('tab', { name: 'Report' }))
    expect(onChange).toHaveBeenCalledWith('report')
  })

  it('moves with the arrow keys and wraps at both ends', () => {
    const onChange = renderTabs({ value: 'report' })
    const report = screen.getByRole('tab', { name: 'Report' })

    fireEvent.keyDown(report, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith('presets')

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Presets' }), { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenLastCalledWith('report')
  })

  it('jumps to the first and last tab with Home and End', () => {
    const onChange = renderTabs({ value: 'parameters' })
    const current = screen.getByRole('tab', { name: 'Parameters' })

    fireEvent.keyDown(current, { key: 'End' })
    expect(onChange).toHaveBeenLastCalledWith('report')

    fireEvent.keyDown(current, { key: 'Home' })
    expect(onChange).toHaveBeenLastCalledWith('presets')
  })

  it('moves keyboard focus to the tab it selects', () => {
    renderTabs({ value: 'presets' })
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Presets' }), { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Parameters' })).toHaveFocus()
  })

  it('states the mesh verdict on the Report tab so a screen reader hears it', () => {
    renderTabs({ reportIndicator: { tone: 'invalid', label: 'mesh invalid' } })
    expect(screen.getByRole('tab', { name: /Report.*mesh invalid/i })).toBeInTheDocument()
  })

  it('says so when a generation error is waiting in the Report tab', () => {
    renderTabs({ reportIndicator: { tone: 'invalid', label: 'error' } })
    expect(screen.getByRole('tab', { name: /Report.*error/i })).toBeInTheDocument()
  })

  it('shows no indicator while there is nothing to report', () => {
    renderTabs({ reportIndicator: null })
    expect(screen.getByRole('tab', { name: 'Report' })).toBeInTheDocument()
  })
})
