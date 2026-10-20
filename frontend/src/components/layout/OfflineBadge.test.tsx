import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { OfflineBadge } from '@/components/layout/OfflineBadge'

// @req REQ-STA-04

describe('OfflineBadge', () => {
  it('says the device is offline, as a status a screen reader can find', () => {
    render(<OfflineBadge />)
    expect(screen.getByRole('status')).toHaveTextContent('Offline')
  })
})
