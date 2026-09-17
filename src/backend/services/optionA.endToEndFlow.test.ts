/**
 * Deterministic Option A end-to-end backend flow (memory).
 * Voice/AI → ApplicantProfile → scheme → TrackedApplication → ministry →
 * approval → signatures/audit → chain anchor → status.
 * Never claims a real government transaction.
 */

import { describe, expect, it } from 'vitest'
import { createBackendServices } from './createBackendServices'
import {
  createEmptyApplicantProfile,
  withApplicantFields,
} from '../../shared/applicantProfile'
import { newApplicationId, isApplicationId } from '../../apply/application'
import type { TrackedApplication } from '../../apply/types'
import { fixtureLokScore, fixtureApplicationSnapshot } from '../../lib/approval/fixtures'
import type { ApprovalCase, AuditEvent, ApprovalSignature } from '../../lib/approval/contracts'
import { resolveMinistryForScheme } from './ministryMapping'
import { SCHEME_TS_IDS } from './schemeCatalogService'
import { createLiveRetrievalGateway } from './liveRetrievalGateway'
import type { LiveRetriever } from '../../assistant/liveRetrieval'
import type { LiveEvidenceItem } from '../../assistant/types'

describe('Option A end-to-end backend flow (memory)', () => {
  it('runs profile → scheme → application → ministry → approval → status', async () => {
    const backend = createBackendServices({ mode: 'memory' })

    // 1–2. ApplicantProfile persist
    const profile = await backend.sharedProfiles.create(
      withApplicantFields(
        createEmptyApplicantProfile(),
        {
          name: 'We Flow',
          socialCategory: 'sc',
          businessSector: 'dairy',
          annualIncome: 180000,
          state: 'Karnataka',
        },
        { source: 'ai_extracted', confidence: 'medium' },
      ),
    )
    expect(profile.data.name).toBe('We Flow')
    expect(profile.applicantId).toBeTruthy()

    // 3. Verified scheme from schemes.ts SoT (not invented)
    const scheme = await backend.schemeCatalog.get(SCHEME_TS_IDS.microFinance)
    expect(scheme).not.toBeNull()
    expect(scheme!.id).toBe('nsfdc-micro-finance')
    expect(scheme!.sourceUrl.startsWith('https://')).toBe(true)

    // 4–6. TrackedApplication + ministry routing
    const applicationId = newApplicationId()
    expect(isApplicationId(applicationId)).toBe(true)
    const ministryId = resolveMinistryForScheme(scheme!.id)
    expect(ministryId).toBe('social_justice')

    const now = new Date().toISOString()
    const app: TrackedApplication = {
      applicationId,
      trackingId: `TRK-${applicationId}`,
      schemeId: scheme!.id,
      schemeName: scheme!.name,
      channel: 'guided',
      outcome: 'guided_packet_ready',
      filedWithGovernment: false,
      simulation: false,
      honestLabel: 'Guided packet ready — not filed with government',
      detail: 'Local packet only',
      nextSteps: ['Visit SCA with documents'],
      packet: {
        schemeId: scheme!.id,
        schemeName: scheme!.name,
        channel: 'guided',
        fields: { applicant_name: 'We Flow' },
        documents: [],
        officialApplicationUrl: scheme!.officialApplicationUrl,
        generatedAt: now,
      },
      consent: {
        accepted: true,
        acceptedAt: now,
        text: 'I understand this packet is not a government submission.',
        channel: 'guided',
        simulate: false,
      },
      statusHistory: [{ at: now, step: 'application_id', note: 'created' }],
      createdAt: now,
      updatedAt: now,
    }
    await backend.aditaApplications.save(app)
    await backend.aditaApplications.appendEvent(applicationId, 'ministry_routed', {
      ministryId,
    })

    // 7–10. Jordan approval case + signature + audit + simulated chain anchor
    const snapshot = fixtureApplicationSnapshot(72, {
      applicationId,
      schemeId: scheme!.id,
      applicantRef: profile.applicantId ?? 'ref',
      lokScore: fixtureLokScore(72),
    })
    const approvalCase: ApprovalCase = {
      applicationId,
      snapshot,
      snapshotDigest: '0xdigest-flow',
      policy: {
        quorumRequired: 2,
        quorumPool: 3,
        mentorRequired: false,
        derivedFromScore: 72,
      },
      allocation: {
        applicationId,
        allocatedReviewerIds: ['r1', 'r2'],
        allocatedAddresses: ['0xaaa', '0xbbb'],
        quorumPool: 3,
        mentorRequired: false,
        mentorReviewerIds: [],
        allocationDigest: '0xalloc-flow',
        allocatedAt: Date.now(),
      },
      signatures: [],
      status: 'open',
    }
    await backend.jordanApprovals.saveCase(approvalCase)

    const signature: ApprovalSignature = {
      reviewerId: 'r1',
      address: '0xaaa',
      signature: '0xsig1',
      signedAt: Date.now(),
    }
    await backend.jordanApprovals.saveSignatures(applicationId, [signature])

    const audit: AuditEvent = {
      eventId: `evt-${applicationId}-1`,
      applicationId,
      eventType: 'signature_collected',
      timestamp: Date.now(),
      actorRef: 'r1',
      prevEventHash: null,
      eventHash: '0xhash1',
    }
    await backend.jordanApprovals.appendAuditEvents([audit])

    const anchor = await backend.jordanApprovals.saveAuthorizationAnchor(
      {
        applicationId,
        applicationHash: '0xapphash',
        quorumRequired: 2,
        quorumPool: 3,
        mentorRequired: false,
        acceptedSignerRefs: ['r1'],
        authorizedAt: Date.now(),
        auditHeadHash: '0xhash1',
        authorizationDigest: '0xauth',
        simulated: true,
      },
      { chainId: 'sim-local' },
    )
    expect(anchor.simulated).toBe(true)

    // 11–12. Status / admin
    const loaded = await backend.aditaApplications.get(applicationId)
    expect(loaded?.schemeId).toBe(scheme!.id)
    expect(loaded?.filedWithGovernment).toBe(false)

    const detail = await backend.admin.getDetail(applicationId)
    expect(detail?.schemeExistsInSourceOfTruth).toBe(true)
    expect(detail?.outcome).toBe('guided_packet_ready')

    const storedCase = await backend.jordanApprovals.getCase(applicationId)
    expect(storedCase?.applicationId).toBe(applicationId)

    const events = await backend.jordanApprovals.listAuditEvents(applicationId)
    expect(events.some((e) => e.eventType === 'signature_collected')).toBe(true)

    // Discovery additive; live retrieval unavailable in memory without Edge
    expect(backend.discovery).toBeDefined()
    const live = await backend.liveRetrieval.retrieve({ schemeIds: [scheme!.id] })
    expect(live.errorCode).toBe('not_configured')
    expect(live.items).toEqual([])
  })

  it('rejects invalid application ids and does not invent schemes', async () => {
    const backend = createBackendServices({ mode: 'memory' })
    await expect(
      backend.aditaApplications.save({
        applicationId: 'not-an-lp-app',
        trackingId: 'x',
        schemeId: 'nsfdc-micro-finance',
        schemeName: 'x',
        channel: 'guided',
        outcome: 'guided_packet_ready',
        filedWithGovernment: false,
        simulation: false,
        honestLabel: 'x',
        detail: 'x',
        nextSteps: [],
        packet: {
          schemeId: 'nsfdc-micro-finance',
          schemeName: 'x',
          channel: 'guided',
          fields: {},
          documents: [],
          officialApplicationUrl: 'https://nsfdc.nic.in/',
          generatedAt: new Date().toISOString(),
        },
        consent: {
          accepted: true,
          text: 'x',
          channel: 'guided',
          simulate: false,
        },
        statusHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    ).rejects.toThrow(/Invalid Adita applicationId/)

    expect(await backend.schemeCatalog.get('totally-fake-scheme')).toBeNull()
  })
})

describe('live retrieval gateway hardening', () => {
  it('drops untrusted / unknown-scheme evidence and never invents facts', async () => {
    const fakeItems: LiveEvidenceItem[] = [
      {
        schemeId: 'nsfdc-micro-finance',
        sourceName: 'data.gov.in',
        sourceUrl: 'https://api.data.gov.in/resource/abc',
        sourceType: 'official_open_data',
        verificationStatus: 'live_official',
        retrievedAt: new Date().toISOString(),
        summary: '1204 units sanctioned',
      },
      {
        schemeId: 'totally-fake',
        sourceName: 'evil',
        sourceUrl: 'https://evil.example/x',
        sourceType: 'official_open_data',
        verificationStatus: 'live_official',
        retrievedAt: new Date().toISOString(),
        summary: 'invented',
      },
    ]
    const retriever: LiveRetriever = {
      isAvailable: async () => true,
      retrieve: async () => fakeItems,
    }
    const gw = createLiveRetrievalGateway(retriever)
    const result = await gw.retrieve({ schemeIds: ['nsfdc-micro-finance', 'totally-fake'] })
    expect(result.ok).toBe(true)
    // validateLiveEvidenceItems rejects untrusted domain + unknown scheme
    expect(result.items.every((i) => i.schemeId === 'nsfdc-micro-finance')).toBe(true)
    expect(result.items.every((i) => i.sourceUrl.startsWith('https://'))).toBe(true)
    expect(result.items.some((i) => i.schemeId === 'totally-fake')).toBe(false)
  })

  it('surfaces upstream failures explicitly', async () => {
    const retriever: LiveRetriever = {
      isAvailable: async () => true,
      retrieve: async () => {
        throw new Error('Live retrieval timed out after 4000ms')
      },
    }
    const gw = createLiveRetrievalGateway(retriever)
    const result = await gw.retrieve({ schemeIds: ['nsfdc-micro-finance'] })
    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('timeout')
    expect(result.items).toEqual([])
  })
})
