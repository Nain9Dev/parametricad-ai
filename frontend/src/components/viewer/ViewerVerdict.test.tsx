import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ViewerVerdict } from '@/components/viewer/ViewerVerdict'
import type { GeneratedModel, MeshQualityReport, MeshQualityStatus } from '@/types/api'

// @req REQ-UBI-19

/** The report of the bundled flange, the part the app opens on: valid, 3 392 triangles. */
const FLANGE: MeshQualityReport = (
  JSON.parse(
    readFileSync(resolve(process.cwd(), 'public/presets/flange.json'), 'utf-8'),
  ) as { model: GeneratedModel }
).model.quality

function withStatus(status: MeshQualityStatus): MeshQualityReport {
  return { ...FLANGE, status }
}

describe('ViewerVerdict', () => {
  it('reads the verdict and the triangle count of the part on the canvas', () => {
    render(<ViewerVerdict report={FLANGE} onDetails={vi.fn()} />)

    const chip = screen.getByRole('button', { name: /^Valid/ })
    expect(chip).toHaveTextContent('3,392 triangles')
  })

  it.each([
    ['valid', 'Valid', 'text-valid'],
    ['degraded', 'Degraded', 'text-warn'],
    ['invalid', 'Invalid', 'text-invalid'],
  ] as const)('says %s in the tone of the Mesh validation card', (status, word, tone) => {
    render(<ViewerVerdict report={withStatus(status)} onDetails={vi.fn()} />)

    const chip = screen.getByRole('button', { name: new RegExp(`^${word}`) })
    expect(chip.querySelector(`span.${tone}`)).toHaveTextContent(word)
  })

  it('leads to the full report', () => {
    const onDetails = vi.fn()
    render(<ViewerVerdict report={FLANGE} onDetails={onDetails} />)

    fireEvent.click(screen.getByRole('button', { name: /^Valid/ }))
    expect(onDetails).toHaveBeenCalledTimes(1)
  })
})
