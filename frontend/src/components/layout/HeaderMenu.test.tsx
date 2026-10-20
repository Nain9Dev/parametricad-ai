import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { HeaderMenu } from '@/components/layout/HeaderMenu'

// @req REQ-UBI-12

function renderMenu(props: Partial<Parameters<typeof HeaderMenu>[0]> = {}) {
  const onExportProject = vi.fn()
  const onImportProject = vi.fn()
  const view = render(
    <HeaderMenu
      hasModel
      onExportProject={onExportProject}
      onImportProject={onImportProject}
      {...props}
    />,
  )
  return { onExportProject, onImportProject, ...view }
}

const trigger = () => screen.getByRole('button', { name: 'Project menu' })

describe('HeaderMenu', () => {
  it('stays closed until the trigger is pressed', () => {
    renderMenu()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
    expect(trigger()).toHaveAttribute('aria-haspopup', 'menu')
  })

  it('opens a menu with the two project actions', () => {
    renderMenu()
    fireEvent.click(trigger())

    expect(trigger()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menu', { name: 'Project' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Save project' })).toBeEnabled()
    expect(screen.getByRole('menuitem', { name: 'Open project' })).toBeEnabled()
  })

  it('saves the project and closes', () => {
    const { onExportProject } = renderMenu()
    fireEvent.click(trigger())
    fireEvent.click(screen.getByRole('menuitem', { name: 'Save project' }))

    expect(onExportProject).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('offers nothing to save while there is no model', () => {
    const { onExportProject } = renderMenu({ hasModel: false })
    fireEvent.click(trigger())

    const save = screen.getByRole('menuitem', { name: 'Save project' })
    expect(save).toBeDisabled()
    fireEvent.click(save)
    expect(onExportProject).not.toHaveBeenCalled()
  })

  it('closes on Escape and returns focus to the trigger', () => {
    renderMenu()
    fireEvent.click(trigger())
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger()).toHaveFocus()
  })

  it('closes when the press lands outside it', () => {
    renderMenu()
    fireEvent.click(trigger())
    fireEvent.pointerDown(document.body)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('moves between items with the arrow keys', () => {
    renderMenu()
    fireEvent.click(trigger())

    const save = screen.getByRole('menuitem', { name: 'Save project' })
    const open = screen.getByRole('menuitem', { name: 'Open project' })
    expect(save).toHaveFocus()

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' })
    expect(open).toHaveFocus()

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' })
    expect(save).toHaveFocus()
  })

  it('imports the spec from a chosen project file', async () => {
    const { onImportProject, container } = renderMenu()
    const spec = { kind: 'pipe', material: 'stainless_steel', length_mm: 200 }
    const file = new File([JSON.stringify({ model: { spec } })], 'project.json', {
      type: 'application/json',
    })

    const input = container.querySelector('input[type="file"]')
    expect(input).not.toBeNull()
    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } })

    await waitFor(() => expect(onImportProject).toHaveBeenCalledWith(spec))
  })

  it('ignores a file that is not a project', async () => {
    const { onImportProject, container } = renderMenu()
    const file = new File(['not json'], 'notes.json', { type: 'application/json' })

    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [file] },
    })

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(onImportProject).not.toHaveBeenCalled()
  })
})
