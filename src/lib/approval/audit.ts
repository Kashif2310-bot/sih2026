import { solidityPackedKeccak256 } from 'ethers'
import type { AuditEvent, AuditEventType } from './contracts'

const GENESIS = '0x' + '00'.repeat(32)

export function hashAuditEvent(input: {
  eventId: string
  applicationId: string
  eventType: AuditEventType
  timestamp: number
  actorRef: string
  dataRef: string
  prevEventHash: string
}): string {
  return solidityPackedKeccak256(
    ['string', 'string', 'string', 'uint256', 'string', 'string', 'bytes32'],
    [
      input.eventId,
      input.applicationId,
      input.eventType,
      input.timestamp,
      input.actorRef,
      input.dataRef,
      input.prevEventHash,
    ],
  )
}

export function appendAuditEvent(
  log: readonly AuditEvent[],
  input: {
    applicationId: string
    eventType: AuditEventType
    timestamp?: number
    actorRef?: string
    dataRef?: string
  },
): AuditEvent[] {
  const timestamp = input.timestamp ?? Date.now()
  const prevEventHash = log.length === 0 ? null : log[log.length - 1].eventHash
  const prev = prevEventHash ?? GENESIS
  const actorRef = input.actorRef ?? ''
  const dataRef = input.dataRef ?? ''
  const eventId = solidityPackedKeccak256(
    ['string', 'uint256', 'string', 'uint256'],
    [input.applicationId, timestamp, input.eventType, log.length],
  )
  const eventHash = hashAuditEvent({
    eventId,
    applicationId: input.applicationId,
    eventType: input.eventType,
    timestamp,
    actorRef,
    dataRef,
    prevEventHash: prev,
  })
  const event: AuditEvent = {
    eventId,
    applicationId: input.applicationId,
    eventType: input.eventType,
    timestamp,
    actorRef: input.actorRef,
    dataRef: input.dataRef,
    prevEventHash,
    eventHash,
  }
  return [...log, event]
}

export function verifyAuditChain(log: readonly AuditEvent[]): { ok: boolean; reason?: string } {
  for (let i = 0; i < log.length; i++) {
    const event = log[i]
    const expectedPrev = i === 0 ? null : log[i - 1].eventHash
    if (event.prevEventHash !== expectedPrev) {
      return { ok: false, reason: `broken prev-hash link at index ${i}` }
    }
    const prev = event.prevEventHash ?? GENESIS
    const recomputed = hashAuditEvent({
      eventId: event.eventId,
      applicationId: event.applicationId,
      eventType: event.eventType,
      timestamp: event.timestamp,
      actorRef: event.actorRef ?? '',
      dataRef: event.dataRef ?? '',
      prevEventHash: prev,
    })
    if (recomputed.toLowerCase() !== event.eventHash.toLowerCase()) {
      return { ok: false, reason: `event hash mismatch at index ${i}` }
    }
  }
  return { ok: true }
}

export function auditHeadHash(log: readonly AuditEvent[]): string {
  if (log.length === 0) return GENESIS
  return log[log.length - 1].eventHash
}
