import { Wallet, solidityPackedKeccak256, verifyMessage, getBytes } from 'ethers'
import type { LokScoreBreakdown } from './lokScore'

export interface Verifier {
  id: string
  name: string
  nameKn: string
  role: string
  roleKn: string
  wallet: Wallet
}

export interface Attestation {
  reportHash: string
  entrepreneurName: string
  villageId: string
  lokScore: number
  schemeId: string
  projectCost: number
  loanAmount: number
  quorumRequired: number
  quorumPool: number
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

const META = [
  { id: 'sca-1', name: 'Priya Hegde', nameKn: 'ಪ್ರಿಯಾ ಹೆಗಡೆ', role: 'SCA District Officer', roleKn: 'ಎಸ್‌ಸಿಎ ಜಿಲ್ಲಾ ಅಧಿಕಾರಿ' },
  { id: 'sca-2', name: 'Ramesh Naik', nameKn: 'ರಮೇಶ್ ನಾಯ್ಕ್', role: 'Bank Channel Partner', roleKn: 'ಬ್ಯಾಂಕ್ ಚಾನೆಲ್ ಪಾರ್ಟನರ್' },
  { id: 'sca-3', name: 'Dr. Anita Rao', nameKn: 'ಡಾ. ಅನಿತಾ ರಾವ್', role: 'Block Mentor', roleKn: 'ಬ್ಲಾಕ್ ಮಾರ್ಗದರ್ಶಕಿ' },
  { id: 'sca-4', name: 'Suresh Patil', nameKn: 'ಸುರೇಶ್ ಪಾಟೀಲ್', role: 'NSFDC State Nodal', roleKn: 'ಎನ್‌ಎಸ್‌ಎಫ್‌ಡಿಸಿ ರಾಜ್ಯ ನೋಡಲ್' },
  { id: 'sca-5', name: 'Lakshmi Bai', nameKn: 'ಲಕ್ಷ್ಮೀ ಬಾಯಿ', role: 'SHG Federation Lead', roleKn: 'ಸ್ವಸಹಾಯ ಸಂಘಟನೆ ಮುಖ್ಯಸ್ಥೆ' },
]

export function createVerifierPool(): Verifier[] {
  return META.map((m, i) => ({
    ...m,
    wallet: new Wallet(SEEDS[i]),
  }))
}

export function buildAttestation(payload: Omit<Attestation, 'reportHash' | 'timestamp'>): Attestation {
  const timestamp = Date.now()
  const reportHash = solidityPackedKeccak256(
    ['string', 'string', 'uint256', 'string', 'uint256', 'uint256', 'uint256'],
    [
      payload.entrepreneurName,
      payload.villageId,
      payload.lokScore,
      payload.schemeId,
      payload.projectCost,
      payload.loanAmount,
      timestamp,
    ],
  )
  return { ...payload, reportHash, timestamp }
}

export function attestationMessage(a: Attestation) {
  return [
    'LokPulse NSFDC Sanction Attestation',
    `Hash: ${a.reportHash}`,
    `Entrepreneur: ${a.entrepreneurName}`,
    `Village: ${a.villageId}`,
    `LokScore: ${a.lokScore}`,
    `Scheme: ${a.schemeId}`,
    `Project: ${a.projectCost}`,
    `Loan: ${a.loanAmount}`,
    `Quorum: ${a.quorumRequired}/${a.quorumPool}`,
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

export function quorumMet(score: LokScoreBreakdown, signatures: SignatureRecord[]) {
  return signatures.length >= score.quorumRequired
}

/** Compact bytes for UI “on-chain packet” preview */
export function packetPreview(a: Attestation) {
  return getBytes(a.reportHash)
}
