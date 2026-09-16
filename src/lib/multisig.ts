import { Wallet, verifyMessage, getBytes } from 'ethers'
import type { LokScoreBreakdown } from './lokScore'
import {
  hashApprovalPayload,
  type ApplicationSnapshot,
} from './approval/contracts'
import type { ReviewerRole } from './approval/contracts'

export interface Verifier {
  id: string
  name: string
  nameKn: string
  role: string
  roleKn: string
  roleKey: ReviewerRole
  wallet: Wallet
}

export interface Attestation {
  reportHash: string
  applicationId: string
  entrepreneurName: string
  villageId: string
  lokScore: number
  demand: number
  competitionGap: number
  weatherFit: number
  financialFit: number
  eligibility: number
  schemeId: string
  projectCost: number
  loanAmount: number
  quorumRequired: number
  quorumPool: number
  mentorRequired: boolean
  timestamp: number
}

export interface SignatureRecord {
  verifierId: string
  address: string
  signature: string
  signedAt: number
}

/** Deterministic demo SCA wallets — real secp256k1 keys, same every reload */
const SEEDS = [
  '0x1111111111111111111111111111111111111111111111111111111111111111',
  '0x2222222222222222222222222222222222222222222222222222222222222222',
  '0x3333333333333333333333333333333333333333333333333333333333333333',
  '0x4444444444444444444444444444444444444444444444444444444444444444',
  '0x5555555555555555555555555555555555555555555555555555555555555555',
]

const META: Array<Omit<Verifier, 'wallet'>> = [
  {
    id: 'sca-1',
    name: 'Priya Hegde',
    nameKn: 'ಪ್ರಿಯಾ ಹೆಗಡೆ',
    role: 'SCA District Officer',
    roleKn: 'ಎಸ್‌ಸಿಎ ಜಿಲ್ಲಾ ಅಧಿಕಾರಿ',
    roleKey: 'sca_officer',
  },
  {
    id: 'sca-2',
    name: 'Ramesh Naik',
    nameKn: 'ರಮೇಶ್ ನಾಯ್ಕ್',
    role: 'Bank Channel Partner',
    roleKn: 'ಬ್ಯಾಂಕ್ ಚಾನೆಲ್ ಪಾರ್ಟನರ್',
    roleKey: 'bank_channel',
  },
  {
    id: 'sca-3',
    name: 'Dr. Anita Rao',
    nameKn: 'ಡಾ. ಅನಿತಾ ರಾವ್',
    role: 'Block Mentor',
    roleKn: 'ಬ್ಲಾಕ್ ಮಾರ್ಗದರ್ಶಕಿ',
    roleKey: 'mentor',
  },
  {
    id: 'sca-4',
    name: 'Suresh Patil',
    nameKn: 'ಸುರೇಶ್ ಪಾಟೀಲ್',
    role: 'NSFDC State Nodal',
    roleKn: 'ಎನ್‌ಎಸ್‌ಎಫ್‌ಡಿಸಿ ರಾಜ್ಯ ನೋಡಲ್',
    roleKey: 'nsfdc_nodal',
  },
  {
    id: 'sca-5',
    name: 'Lakshmi Bai',
    nameKn: 'ಲಕ್ಷ್ಮೀ ಬಾಯಿ',
    role: 'SHG Federation Lead',
    roleKn: 'ಸ್ವಸಹಾಯ ಸಂಘಟನೆ ಮುಖ್ಯಸ್ಥೆ',
    roleKey: 'shg_lead',
  },
]

export function createVerifierPool(): Verifier[] {
  return META.map((m, i) => ({
    ...m,
    wallet: new Wallet(SEEDS[i]),
  }))
}

export function hashAttestationFields(payload: Omit<Attestation, 'reportHash'>): string {
  return hashApprovalPayload({
    applicationId: payload.applicationId,
    applicantRef: payload.entrepreneurName,
    villageId: payload.villageId,
    schemeId: payload.schemeId,
    projectCost: payload.projectCost,
    loanAmount: payload.loanAmount,
    demand: payload.demand,
    competitionGap: payload.competitionGap,
    weatherFit: payload.weatherFit,
    financialFit: payload.financialFit,
    eligibility: payload.eligibility,
    lokScoreTotal: payload.lokScore,
    quorumRequired: payload.quorumRequired,
    quorumPool: payload.quorumPool,
    mentorRequired: payload.mentorRequired,
    frozenAt: payload.timestamp,
  })
}

export function buildAttestation(payload: Omit<Attestation, 'reportHash'>): Attestation {
  return { ...payload, reportHash: hashAttestationFields(payload) }
}

export function buildAttestationFromSnapshot(snapshot: ApplicationSnapshot): Attestation {
  const s = snapshot.lokScore
  return buildAttestation({
    applicationId: snapshot.applicationId,
    entrepreneurName: snapshot.applicantRef,
    villageId: snapshot.villageId,
    lokScore: s.total,
    demand: s.demand,
    competitionGap: s.competitionGap,
    weatherFit: s.weatherFit,
    financialFit: s.financialFit,
    eligibility: s.eligibility,
    schemeId: snapshot.schemeId,
    projectCost: snapshot.projectCost,
    loanAmount: snapshot.loanAmount,
    quorumRequired: s.quorumRequired,
    quorumPool: s.quorumPool,
    mentorRequired: s.mentorRequired,
    timestamp: snapshot.frozenAt,
  })
}

export function attestationMessage(a: Attestation) {
  return [
    'LokPulse NSFDC Sanction Attestation',
    `Hash: ${a.reportHash}`,
    `ApplicationId: ${a.applicationId}`,
    `Entrepreneur: ${a.entrepreneurName}`,
    `Village: ${a.villageId}`,
    `LokScore: ${a.lokScore}`,
    `Components: ${a.demand}/${a.competitionGap}/${a.weatherFit}/${a.financialFit}/${a.eligibility}`,
    `Scheme: ${a.schemeId}`,
    `Project: ${a.projectCost}`,
    `Loan: ${a.loanAmount}`,
    `Quorum: ${a.quorumRequired}/${a.quorumPool}`,
    `MentorRequired: ${a.mentorRequired ? '1' : '0'}`,
    `Ts: ${a.timestamp}`,
  ].join('\n')
}

export async function signAttestation(verifier: Verifier, a: Attestation): Promise<SignatureRecord> {
  const message = attestationMessage(a)
  const signature = await verifier.wallet.signMessage(message)
  return {
    verifierId: verifier.id,
    address: verifier.wallet.address,
    signature,
    signedAt: Date.now(),
  }
}

export function verifySignature(a: Attestation, record: SignatureRecord): boolean {
  try {
    const recovered = verifyMessage(attestationMessage(a), record.signature)
    return recovered.toLowerCase() === record.address.toLowerCase()
  } catch {
    return false
  }
}

export function verifySignatureForReviewer(
  a: Attestation,
  record: SignatureRecord,
  expectedAddress: string,
): boolean {
  if (record.address.toLowerCase() !== expectedAddress.toLowerCase()) return false
  return verifySignature(a, record)
}

export function quorumMet(score: LokScoreBreakdown, signatures: SignatureRecord[]) {
  return signatures.length >= score.quorumRequired
}

/** Compact bytes for UI “on-chain packet” preview */
export function packetPreview(a: Attestation) {
  return getBytes(a.reportHash)
}
