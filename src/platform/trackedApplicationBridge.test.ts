import { beforeEach, describe, expect, it } from 'vitest'
import { isApplicationId, newApplicationId } from '../apply/application'
import { getSchemeApplicationSpec } from '../apply/catalog'
import { saveTrackedApplication } from '../apply/store'
import { prepareApplication, submitApplication } from '../apply/workflow'
import { EMPTY_PROFILE, type UserProfile } from '../assistant/types'
import { peekApprovalCase, resetApprovalService } from './approvalBridge'
import { getApplication, listApplications } from './store'
import { ingestTrackedApplication, nsfdcSchemeIdFromCatalog } from './trackedApplicationBridge'

const POULTRY: UserProfile = {
  ...EMPTY_PROFILE,
  age: 24,
  areaType: 'rural',
  state: 'Karnataka',
  district: 'Mandya',
  socialCategory: 'sc',
  gender: 'female',
  annualIncome: 200_000,
  businessSector: 'poultry',
  businessStage: 'new',
  businessStatus: 'idea',
  investmentRequired: 300_000,
  ownContribution: 30_000,
}

function completeOverrides(): Record<string, string | number | boolean> {
  return {
    applicant_name: 'Lakshmi S',
    mobile: '9876543210',
  }
}

function declareAllDocs(schemeId: string) {
  const spec = getSchemeApplicationSpec(schemeId)
  const declarations: Record<string, 'declared_available'> = {}
  for (const d of spec.documents) declarations[d.key] = 'declared_available'
  return declarations
}

beforeEach(() => {
  localStorage.clear()
  resetApprovalService()
})

describe('trackedApplicationBridge', () => {
  it('maps NSFDC catalog ids onto platform SchemeId without minting a second identity', () => {
    expect(nsfdcSchemeIdFromCatalog('nsfdc-term-loan')).toBe('term_loan')
    expect(nsfdcSchemeIdFromCatalog('nsfdc-micro-finance')).toBe('micro_finance')
  })

  it('projects an Assistant Apply TrackedApplication into admin with the same LP-APP-* id', async () => {
    const applicationId = newApplicationId()
    expect(isApplicationId(applicationId)).toBe(true)

    const prepared = prepareApplication({
      schemeId: 'nsfdc-term-loan',
      profile: POULTRY,
      fieldOverrides: completeOverrides(),
      documentDeclarations: declareAllDocs('nsfdc-term-loan'),
      channel: 'assisted',
    })
    const tracked = await submitApplication({
      prepared,
      channel: 'assisted',
      consentAccepted: true,
      simulate: false,
      applicationId,
      conversation: { source: 'assistant', extractedProfile: { ...POULTRY } },
      config: { randomId: () => 'ASSIST1' },
    })

    expect(tracked.applicationId).toBe(applicationId)
    expect(tracked.applicationId).toMatch(/^LP-APP-[A-F0-9]{16}$/i)
    saveTrackedApplication(tracked)

    const projected = ingestTrackedApplication(tracked)
    expect(projected).not.toBeNull()
    expect(projected!.id).toBe(applicationId)
    expect(projected!.id).toBe(tracked.applicationId)
    expect(listApplications().some((a) => a.id === applicationId)).toBe(true)
    expect(getApplication(applicationId)?.schemeName).toBe(tracked.schemeName)

    const approval = peekApprovalCase(applicationId)
    expect(approval?.applicationId).toBe(applicationId)

    const again = ingestTrackedApplication(tracked)
    expect(again?.id).toBe(applicationId)
    expect(listApplications().filter((a) => a.id === applicationId)).toHaveLength(1)
  })

  it('does not ingest blocked packets', async () => {
    const prepared = prepareApplication({
      schemeId: 'nsfdc-term-loan',
      profile: POULTRY,
      fieldOverrides: completeOverrides(),
      documentDeclarations: declareAllDocs('nsfdc-term-loan'),
    })
    const blocked = await submitApplication({
      prepared,
      channel: 'guided',
      consentAccepted: false,
      simulate: false,
    })
    expect(ingestTrackedApplication(blocked)).toBeNull()
    expect(listApplications()).toHaveLength(0)
  })
})
