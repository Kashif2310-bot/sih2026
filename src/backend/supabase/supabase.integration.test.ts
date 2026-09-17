/**
 * Supabase integration tests — Option A schema + RLS hardening.
 * Enable: SUPABASE_INTEGRATION=1 with URL + service role in .env.local
 * AND apply supabase/bundles/option_a_hosted_apply.sql first.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isSupabaseIntegrationEnabled, getSupabaseServerConfig } from './config'
import {
  createAnonClient,
  createServiceRoleClient,
  type LokPulseSupabaseClient,
} from './client'
import { createBackendServices, type BackendServices } from '../services/createBackendServices'
import { SCHEME_TS_IDS } from '../services/schemeCatalogService'
import { withApplicantFields, createEmptyApplicantProfile } from '../../shared/applicantProfile'
import { newApplicationId } from '../../apply/application'
import type { TrackedApplication } from '../../apply/types'
import { fixtureLokScore } from '../../lib/approval/fixtures'

const enabled = isSupabaseIntegrationEnabled()

describe.skipIf(!enabled)('Supabase integration (Option A)', () => {
  let service: LokPulseSupabaseClient
  let anon: LokPulseSupabaseClient
  let backend: BackendServices
  let createdUserIds: string[] = []

  beforeAll(() => {
    service = createServiceRoleClient()
    anon = createAnonClient()
    backend = createBackendServices({ mode: 'supabase', client: service })
  })

  afterAll(async () => {
    for (const id of createdUserIds) {
      await service.auth.admin.deleteUser(id)
    }
  })

  it('scheme catalog SoT is schemes.ts; cache may optionally mirror NSFDC ids', async () => {
    const list = await backend.schemeCatalog.list()
    expect(list.some((s) => s.id === SCHEME_TS_IDS.microFinance)).toBe(true)

    const { data: cacheRows, error } = await service
      .from('schemes')
      .select('id, verification_status')
      .in('id', [SCHEME_TS_IDS.microFinance, SCHEME_TS_IDS.termLoan])
    expect(error).toBeNull()
    for (const row of cacheRows ?? []) {
      expect([SCHEME_TS_IDS.microFinance, SCHEME_TS_IDS.termLoan]).toContain(row.id)
    }
  })

  it('service config present and ministries seed uses Prerna ids', async () => {
    const cfg = getSupabaseServerConfig()
    expect(cfg.serviceConfigured).toBe(true)
    const { data, error } = await service.from('ministries').select('id, code').eq('id', 'social_justice')
    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThanOrEqual(1)
  })

  it('end-to-end: profile → application → approval → status (service role)', async () => {
    const profile = await backend.sharedProfiles.create(
      withApplicantFields(createEmptyApplicantProfile(), { name: 'Integration We' }, {
        source: 'user_provided',
        confidence: 'high',
      }),
    )
    expect(profile.data.name).toBe('Integration We')

    const applicationId = newApplicationId()
    const now = new Date().toISOString()
    const app: TrackedApplication = {
      applicationId,
      trackingId: `TRK-${applicationId}`,
      schemeId: SCHEME_TS_IDS.microFinance,
      schemeName: 'NSFDC Micro Finance',
      channel: 'guided',
      outcome: 'guided_packet_ready',
      filedWithGovernment: false,
      simulation: false,
      honestLabel: 'Guided packet ready',
      detail: 'integration',
      nextSteps: [],
      packet: {
        schemeId: SCHEME_TS_IDS.microFinance,
        schemeName: 'NSFDC Micro Finance',
        channel: 'guided',
        fields: {},
        documents: [],
        officialApplicationUrl: 'https://nsfdc.nic.in/',
        generatedAt: now,
      },
      consent: {
        accepted: true,
        acceptedAt: now,
        text: 'I consent',
        channel: 'guided',
        simulate: false,
      },
      statusHistory: [{ at: now, step: 'application_id', note: 'it' }],
      createdAt: now,
      updatedAt: now,
    }
    await backend.aditaApplications.save(app)
    expect((await backend.aditaApplications.get(applicationId))?.schemeId).toBe(SCHEME_TS_IDS.microFinance)

    await backend.jordanApprovals.saveCase({
      applicationId,
      snapshot: {
        applicationId,
        applicantRef: 'it-ref',
        villageId: 'dinka-mandya',
        schemeId: SCHEME_TS_IDS.microFinance,
        projectCost: 100000,
        loanAmount: 80000,
        lokScore: fixtureLokScore(72),
        frozenAt: Date.now(),
      },
      snapshotDigest: '0xit',
      policy: { quorumRequired: 2, quorumPool: 3, mentorRequired: false, derivedFromScore: 72 },
      allocation: {
        applicationId,
        allocatedReviewerIds: ['r1'],
        allocatedAddresses: ['0x1'],
        quorumPool: 3,
        mentorRequired: false,
        mentorReviewerIds: [],
        allocationDigest: '0xalloc',
        allocatedAt: Date.now(),
      },
      signatures: [],
      status: 'open',
    })
    expect((await backend.jordanApprovals.getCase(applicationId))?.status).toBe('open')

    const anchor = await backend.jordanApprovals.saveAuthorizationAnchor({
      applicationId,
      applicationHash: '0xhash',
      quorumRequired: 2,
      quorumPool: 3,
      mentorRequired: false,
      acceptedSignerRefs: ['r1'],
      authorizedAt: Date.now(),
      auditHeadHash: '0xhead',
      authorizationDigest: '0xauth',
      simulated: true,
    })
    expect(anchor.simulated).toBe(true)

    const admin = await backend.admin.getDetail(applicationId)
    expect(admin?.schemeExistsInSourceOfTruth).toBe(true)
  })

  it('verify_rls_enabled reports RLS on core tables', async () => {
    const { data, error } = await service.rpc('verify_rls_enabled')
    expect(error).toBeNull()
    const rows = (data ?? []) as Array<{ table_name: string; rls_enabled: boolean }>
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.rls_enabled)).toBe(true)
  })

  it('RLS Scenario C: anon cannot insert into applications or approval_cases', async () => {
    const { error: appErr } = await anon.from('applications').insert({
      application_id: 'LP-APP-ANONINJECT0001',
      scheme_id: 'nsfdc-micro-finance',
      status: 'hacked',
    })
    expect(appErr).not.toBeNull()

    const { error: apprErr } = await anon.from('approval_cases').insert({
      application_id: 'LP-APP-ANONINJECT0001',
      case_json: {},
      status: 'open',
    })
    expect(apprErr).not.toBeNull()
  })

  it('RLS Scenario E: anon cannot update approval_signatures or chain_anchors', async () => {
    const { error: sigErr } = await anon.from('approval_signatures').update({ signature: 'hacked' }).neq('id', '00000000-0000-0000-0000-000000000000')
    // Either RLS denies (error) or zero rows — never a successful write
    if (sigErr == null) {
      // PostgREST may return 200 with empty body when zero rows match under RLS
      const { count } = await anon.from('approval_signatures').select('*', { count: 'exact', head: true })
      expect(count === 0 || count == null).toBe(true)
    }

    const { error: chainErr } = await anon.from('chain_anchors').insert({
      application_id: 'LP-APP-ANONINJECT0001',
      report_hash: '0x',
      mentor_required: false,
      simulated: true,
    })
    expect(chainErr).not.toBeNull()
  })

  it('RLS: anon cannot read full applications rows after hardening; public status RPC works', async () => {
    // Seed via service role
    const applicationId = newApplicationId()
    const now = new Date().toISOString()
    const { error: seedErr } = await service.from('applications').insert({
      application_id: applicationId,
      scheme_id: SCHEME_TS_IDS.microFinance,
      scheme_name: 'NSFDC Micro Finance',
      status: 'application_id',
      outcome: 'guided_packet_ready',
      filed_with_government: false,
      simulation: false,
      honest_label: 'seed',
      detail: 'seed',
      status_history: [],
      created_at: now,
      updated_at: now,
    })
    expect(seedErr).toBeNull()

    const { data: anonRows, error: anonReadErr } = await anon
      .from('applications')
      .select('application_id, packet, consent')
      .eq('application_id', applicationId)
    // After hardening: either error or empty (no public_read)
    expect(anonReadErr == null ? (anonRows ?? []).length === 0 : true).toBe(true)

    const { data: status, error: rpcErr } = await anon.rpc('get_application_status_public', {
      p_application_id: applicationId,
    })
    expect(rpcErr).toBeNull()
    const row = Array.isArray(status) ? status[0] : status
    expect(row?.application_id).toBe(applicationId)
    expect(row?.scheme_id).toBe(SCHEME_TS_IDS.microFinance)
    expect(row).not.toHaveProperty('packet')
  })

  it('RLS Scenario A/B: authenticated user sees only own owned application', async () => {
    const emailA = `lokpulse-a-${Date.now()}@example.com`
    const emailB = `lokpulse-b-${Date.now()}@example.com`
    const password = 'TestPassword123!'

    const { data: userA, error: errA } = await service.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    })
    expect(errA).toBeNull()
    createdUserIds.push(userA.user!.id)

    const { data: userB, error: errB } = await service.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    })
    expect(errB).toBeNull()
    createdUserIds.push(userB.user!.id)

    const appA = newApplicationId()
    const appB = newApplicationId()
    const now = new Date().toISOString()
    const base = {
      scheme_id: SCHEME_TS_IDS.microFinance,
      scheme_name: 'NSFDC Micro Finance',
      status: 'application_id',
      outcome: 'guided_packet_ready',
      filed_with_government: false,
      simulation: false,
      status_history: [],
      created_at: now,
      updated_at: now,
    }
    expect(
      (
        await service.from('applications').insert({
          ...base,
          application_id: appA,
          owner_user_id: userA.user!.id,
        })
      ).error,
    ).toBeNull()
    expect(
      (
        await service.from('applications').insert({
          ...base,
          application_id: appB,
          owner_user_id: userB.user!.id,
        })
      ).error,
    ).toBeNull()

    // Sign in as user A via password grant
    const { data: sessionA, error: signErr } = await anon.auth.signInWithPassword({
      email: emailA,
      password,
    })
    expect(signErr).toBeNull()
    const token = sessionA.session!.access_token
    const clientA = createAnonClient(token)

    const { data: own, error: ownErr } = await clientA
      .from('applications')
      .select('application_id')
      .eq('application_id', appA)
    expect(ownErr).toBeNull()
    expect(own?.[0]?.application_id).toBe(appA)

    const { data: other, error: otherErr } = await clientA
      .from('applications')
      .select('application_id')
      .eq('application_id', appB)
    expect(otherErr == null ? (other ?? []).length === 0 : true).toBe(true)

    await anon.auth.signOut()
  })
})
