import { describe, expect, it } from 'vitest'
import { appendAuditEvent, verifyAuditChain } from './audit'

describe('audit trail', () => {
  it('audit events are append-only and tamper-evident', () => {
    let log = appendAuditEvent([], {
      applicationId: 'app-1',
      eventType: 'application_opened',
      timestamp: 1000,
      dataRef: '0xabc',
    })
    log = appendAuditEvent(log, {
      applicationId: 'app-1',
      eventType: 'reviewer_allocation_created',
      timestamp: 1001,
      dataRef: '0xdef',
    })
    log = appendAuditEvent(log, {
      applicationId: 'app-1',
      eventType: 'signature_collected',
      timestamp: 1002,
      actorRef: 'sca-1',
    })
    expect(verifyAuditChain(log).ok).toBe(true)
    expect(log).toHaveLength(3)
    expect(log[1].prevEventHash).toBe(log[0].eventHash)
    expect(log[2].prevEventHash).toBe(log[1].eventHash)

    const tampered = log.map((e, i) => (i === 1 ? { ...e, dataRef: '0xevil' } : e))
    expect(verifyAuditChain(tampered).ok).toBe(false)

    const relinked = [...log]
    relinked[0] = { ...log[0], eventType: 'quorum_reached' }
    expect(verifyAuditChain(relinked).ok).toBe(false)
  })

  it('does not mutate the previous log array', () => {
    const first = appendAuditEvent([], {
      applicationId: 'app-1',
      eventType: 'application_opened',
      timestamp: 1,
    })
    const copy = [...first]
    appendAuditEvent(first, {
      applicationId: 'app-1',
      eventType: 'quorum_reached',
      timestamp: 2,
    })
    expect(first).toEqual(copy)
    expect(first).toHaveLength(1)
  })
})
