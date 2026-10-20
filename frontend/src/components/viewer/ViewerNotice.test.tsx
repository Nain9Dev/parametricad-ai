import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ViewerNotice } from '@/components/viewer/ViewerNotice'
import { ApiError } from '@/lib/apiClient'

// @req REQ-UNW-04

const OFFLINE = new ApiError('You are offline.', {
  code: 'offline',
  status: 0,
  hint: 'Generating custom parts needs a connection.',
})

const REJECTED = new ApiError('The wall is thicker than the radius.', {
  code: 'invalid_parameters',
  status: 422,
})

describe('ViewerNotice', () => {
  it('announces the failure over the viewer', () => {
    render(<ViewerNotice error={OFFLINE} onRetry={vi.fn()} onDetails={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('You are offline.')
  })

  it('offers Retry for a failure worth retrying', () => {
    const onRetry = vi.fn()
    render(<ViewerNotice error={OFFLINE} onRetry={onRetry} onDetails={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('does not offer Retry for a rejection the backend described', () => {
    render(<ViewerNotice error={REJECTED} onRetry={vi.fn()} onDetails={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('does not offer Retry when there is nothing to retry', () => {
    render(<ViewerNotice error={OFFLINE} onDetails={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('leads to the full explanation in the report', () => {
    const onDetails = vi.fn()
    render(<ViewerNotice error={OFFLINE} onRetry={vi.fn()} onDetails={onDetails} />)

    fireEvent.click(screen.getByRole('button', { name: 'Details' }))
    expect(onDetails).toHaveBeenCalledTimes(1)
  })
})
