import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PromptComposer } from '@/components/generator/PromptComposer'
import { ComponentPicker } from '@/components/generator/ComponentPicker'
import { Button } from '@/components/ui/Button'
import { NumberField } from '@/components/ui/NumberField'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SelectField } from '@/components/ui/SelectField'
import { ToggleButton } from '@/components/ui/ToggleButton'
import { FitButton, OrientationPresets } from '@/components/viewer/ViewerControls'
import type { ComponentDescriptor } from '@/types/api'

// @req REQ-UBI-13

// jsdom applies no stylesheet, so the 44 px touch target is pinned down as a
// contract on the classes that deliver it under `pointer: coarse`. The measured
// result is checked in a touch-emulated browser (see specs/001-installable-mobile-app/plan.md,
// section 7): a DOM audit at 375 x 812 must report no target under 44 px.

describe('REQ-UBI-13: coarse pointers get 44 px targets', () => {
  it.each(['sm', 'md'] as const)('grows a %s Button', (size) => {
    render(<Button size={size}>Go</Button>)
    expect(screen.getByRole('button', { name: 'Go' })).toHaveClass('pointer-coarse:h-11')
  })

  it('grows a ToggleButton', () => {
    render(
      <ToggleButton label="Grid" pressed={false} onToggle={vi.fn()}>
        x
      </ToggleButton>,
    )
    expect(screen.getByRole('button', { name: 'Grid' })).toHaveClass('pointer-coarse:size-11')
  })

  it.each(['sm', 'md'] as const)('grows every segment of a %s SegmentedControl', (size) => {
    render(
      <SegmentedControl
        label="Mode"
        size={size}
        value="a"
        onChange={vi.fn()}
        segments={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
      />,
    )
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toHaveClass('pointer-coarse:h-11')
    }
  })

  it('lays a number field out as minus, value, plus with 44 px buttons and 16 px text', () => {
    render(<NumberField label="Length" value={10} onChange={vi.fn()} />)

    const input = screen.getByLabelText('Length')
    const less = screen.getByRole('button', { name: 'Decrease Length' })
    const more = screen.getByRole('button', { name: 'Increase Length' })

    expect(input).toHaveClass('pointer-coarse:h-11', 'pointer-coarse:text-base')
    expect(less).toHaveClass('pointer-coarse:size-11')
    expect(more).toHaveClass('pointer-coarse:size-11')

    expect(less).toHaveClass('pointer-coarse:order-1')
    expect(input).toHaveClass('pointer-coarse:order-2')
    expect(more).toHaveClass('pointer-coarse:order-3')
  })

  it('grows a SelectField and keeps its text at 16 px', () => {
    render(
      <SelectField
        label="Material"
        value="steel"
        options={[{ value: 'steel', label: 'Steel' }]}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Material')).toHaveClass(
      'pointer-coarse:h-11',
      'pointer-coarse:text-base',
    )
  })

  it('grows every option of the ComponentPicker', () => {
    const components = [
      { kind: 'pipe', label: 'Pipe', description: 'A pipe' },
      { kind: 'flange', label: 'Flange', description: 'A flange' },
    ] as unknown as ComponentDescriptor[]
    render(<ComponentPicker components={components} value="pipe" onChange={vi.fn()} />)
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toHaveClass('pointer-coarse:min-h-11')
    }
  })

  it('grows the camera presets and Fit button of the wide toolbar', () => {
    render(
      <>
        <OrientationPresets active="iso" onSelect={vi.fn()} disabled={false} />
        <FitButton onClick={vi.fn()} disabled={false} />
      </>,
    )
    for (const preset of screen.getAllByRole('button', { name: /Snap camera/ })) {
      expect(preset).toHaveClass('pointer-coarse:h-11')
    }
    expect(screen.getByRole('button', { name: 'Fit camera to geometry bounds' })).toHaveClass(
      'pointer-coarse:h-11',
    )
  })

  it('keeps the description field and its examples comfortable to hit', () => {
    render(
      <PromptComposer onSubmit={vi.fn()} busy={false} extractor={null} currentSpec={null} />,
    )
    expect(screen.getByRole('textbox')).toHaveClass('pointer-coarse:text-base')
    const example = screen.getByRole('button', { name: /Stainless steel pipe/ })
    expect(example).toHaveClass('pointer-coarse:min-h-11')
  })
})
