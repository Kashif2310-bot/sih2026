/**
 * Explicit projection: Adita TrackedApplication (LP-APP-*) → Prerna
 * platform.Application, using the same applicationId.
 *
 * Does not create a second identity, a second store, or a second approval
 * service. Writes a read-model into the existing platform localStorage so
 * /admin can list and review the same record Jordan will sign.
 */
import { isApplicationId } from '../apply/application'
import { loadTrackedApplications } from '../apply/store'
import type { TrackedApplication } from '../apply/types'
import type { BusinessCategory } from '../data/villages'
import { expectedQuorumFromTotal } from '../lib/approval/quorum'
import type { SchemeId } from '../lib/finance'
import { ensureApprovalCase } from './approvalBridge'
import { routeApplication } from './ministries'
import { createApplication, getApplication } from './store'
import type { ApplicantInfo, Application, DocumentRecord } from './types'

const INGESTIBLE_OUTCOMES: TrackedApplication['outcome'][] = [
  'assisted_packet_ready',
  'guided_packet_ready',
  'government_api_unavailable',
  'government_api_rejected',
  'submitted_to_government',
  'simulation_recorded',
]

function fieldString(fields: Record<string, unknown>, key: string): string {
  const v = fields[key]
  if (typeof v === 'string' && v.trim()) return v.trim()
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return ''
}

function fieldNumber(fields: Record<string, unknown>, key: string): number {
  const v = fields[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v)
  return 0
}

function categoryFromTracked(tracked: TrackedApplication): BusinessCategory {
  const extracted = tracked.conversation?.extractedProfile ?? {}
  const raw = String(
    extracted.businessSector ?? tracked.packet.fields.business_sector ?? tracked.packet.fields.category ?? '',
  ).toLowerCase()
  if (raw.includes('dairy') || raw.includes('milk')) return 'dairy'
  if (raw.includes('poultry') || raw.includes('chicken')) return 'poultry'
  if (raw.includes('textile') || raw.includes('weav')) return 'textiles'
  if (raw.includes('agri') || raw.includes('process')) return 'agri_processing'
  if (raw.includes('food') || raw.includes('tiffin')) return 'food'
  if (raw.includes('retail') || raw.includes('kirana') || raw.includes('shop')) return 'retail'
  return 'retail'
}

function genderFromTracked(tracked: TrackedApplication): ApplicantInfo['gender'] {
  const raw = String(tracked.conversation?.extractedProfile?.gender ?? '').toLowerCase()
  if (raw === 'male' || raw === 'female' || raw === 'other') return raw
  return 'other'
}

function communityFromTracked(tracked: TrackedApplication): ApplicantInfo['community'] {
  const raw = String(tracked.conversation?.extractedProfile?.socialCategory ?? '').toLowerCase()
  if (raw === 'sc' || raw === 'st' || raw === 'obc' || raw === 'general') return raw
  return 'general'
}

/** Map assistant catalog ids onto the NSFDC SchemeId union used by platform.Application. */
export function nsfdcSchemeIdFromCatalog(schemeId: string): SchemeId {
  if (schemeId.includes('micro')) return 'micro_finance'
  if (schemeId.includes('term')) return 'term_loan'
  return 'term_loan'
}

export function projectTrackedApplication(tracked: TrackedApplication): Application {
  const fields = tracked.packet.fields as Record<string, unknown>
  const category = categoryFromTracked(tracked)
  const gender = genderFromTracked(tracked)
  const community = communityFromTracked(tracked)
  const routing = routeApplication({ category, gender, community })
  const loanAmount = fieldNumber(fields, 'loan_amount_requested')
  const projectCost = fieldNumber(fields, 'project_cost') || (loanAmount > 0 ? Math.round(loanAmount / 0.9) : 0)
  const createdAt = Date.parse(tracked.createdAt) || Date.now()
  const quorum = expectedQuorumFromTotal(0)
  const applicant: ApplicantInfo = {
    name: fieldString(fields, 'applicant_name') || 'Applicant',
    age: fieldNumber(fields, 'age') || 0,
    gender,
    community,
    phone: fieldString(fields, 'mobile'),
    address: fieldString(fields, 'address') || fieldString(fields, 'state'),
    villageOrTown: fieldString(fields, 'village') || fieldString(fields, 'district'),
    district: fieldString(fields, 'district'),
    state: fieldString(fields, 'state'),
    bankAccountNumber: fieldString(fields, 'bank_account'),
    bankIfsc: fieldString(fields, 'ifsc'),
    category,
    businessDescription: fieldString(fields, 'business_description') || tracked.schemeName,
  }
  const documents: DocumentRecord[] = tracked.packet.documents.map((d) => ({
    id: d.key,
    labelEn: d.label,
    labelKn: d.label,
    status: d.declaration === 'missing' ? 'missing' : 'uploaded',
  }))
  return {
    id: tracked.applicationId,
    createdAt,
    updatedAt: Date.parse(tracked.updatedAt) || createdAt,
    applicant,
    leadMinistryId: routing.leadMinistryId,
    supportingMinistryIds: routing.supportingMinistryIds,
    schemeId: nsfdcSchemeIdFromCatalog(tracked.schemeId),
    schemeName: tracked.schemeName,
    projectCost,
    loanAmount,
    lokScore: 0,
    lokScoreBreakdown: null,
    quorumRequired: quorum.quorumRequired,
    quorumPool: quorum.quorumPool,
    mentorRequired: quorum.mentorRequired,
    documents,
    signatures: [],
    status: 'submitted',
    consentGiven: tracked.consent.accepted,
    consentAt: tracked.consent.acceptedAt ? Date.parse(tracked.consent.acceptedAt) : undefined,
    auditTrail: [
      {
        id: `evt-${createdAt}`,
        at: createdAt,
        actor: applicant.name,
        action: 'submitted',
        detail: `Projected from TrackedApplication ${tracked.applicationId} (${tracked.outcome}). Routed to ${routing.leadMinistryId}.`,
      },
    ],
  }
}

export function ingestTrackedApplication(tracked: TrackedApplication): Application | null {
  if (!isApplicationId(tracked.applicationId)) return null
  if (!INGESTIBLE_OUTCOMES.includes(tracked.outcome)) return null
  const existing = getApplication(tracked.applicationId)
  if (existing) return existing
  const app = projectTrackedApplication(tracked)
  createApplication(app)
  try {
    ensureApprovalCase(app)
  } catch {
    // Approval is session-memory; projection must still land in admin.
  }
  return app
}

export function ingestAllTrackedApplications(): Application[] {
  const out: Application[] = []
  for (const tracked of loadTrackedApplications()) {
    const app = ingestTrackedApplication(tracked)
    if (app) out.push(app)
  }
  return out
}
