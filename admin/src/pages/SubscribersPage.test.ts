import { describe, expect, it } from 'vitest'
import { describeNotifyResult } from './SubscribersPage'

describe('describeNotifyResult', () => {
  it('says how many were told when everyone was reached', () => {
    expect(describeNotifyResult({ sent: 12, failed: 0, remaining: 0, notifiedAt: '2026-10-07T10:00:00Z' })).toEqual({ message: 'Sent to 12 subscribers.', kind: 'success' })
  })

  it('uses the singular for one subscriber', () => {
    expect(describeNotifyResult({ sent: 1, failed: 0, remaining: 0, notifiedAt: null }).message).toBe('Sent to 1 subscriber.')
  })

  it('explains what to do when some are still waiting', () => {
    const { message, kind } = describeNotifyResult({ sent: 300, failed: 2, remaining: 45, notifiedAt: '2026-10-07T10:00:00Z' })

    expect(kind).toBe('success')
    expect(message).toContain('Sent to 300 subscribers.')
    expect(message).toContain('45 subscribers still to go')
    expect(message).toContain('tomorrow')
  })

  it('reports plainly when nothing got through', () => {
    const { message, kind } = describeNotifyResult({ sent: 0, failed: 3, remaining: 20, notifiedAt: null })

    expect(kind).toBe('error')
    expect(message).toMatch(/No emails could be sent/)
  })
})
