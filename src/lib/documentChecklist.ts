import type { SchemeId } from './finance'

export interface ChecklistItem {
  en: string
  kn: string
}

/**
 * Indicative document checklist by NSFDC scheme — generic KYC/lending-scheme
 * categories, not sourced from a specific circular. Always shown with a
 * disclaimer to confirm with the local SCA/channel partner (Rule: no
 * fabricated authority).
 */
const COMMON: ChecklistItem[] = [
  { en: 'Aadhaar card (identity + address proof)', kn: 'ಆಧಾರ್ ಕಾರ್ಡ್ (ಗುರುತು + ವಿಳಾಸ ಪುರಾವೆ)' },
  { en: 'Caste certificate (SC/ST/OBC as applicable)', kn: 'ಜಾತಿ ಪ್ರಮಾಣಪತ್ರ (ಅನ್ವಯಿಸಿದಂತೆ SC/ST/OBC)' },
  { en: 'Income certificate / family income proof', kn: 'ಆದಾಯ ಪ್ರಮಾಣಪತ್ರ / ಕುಟುಂಬ ಆದಾಯ ಪುರಾವೆ' },
  { en: 'Passport-size photographs', kn: 'ಪಾಸ್‌ಪೋರ್ಟ್ ಗಾತ್ರದ ಫೋಟೋಗಳು' },
  { en: 'Bank passbook / account statement', kn: 'ಬ್ಯಾಂಕ್ ಪಾಸ್‌ಬುಕ್ / ಖಾತೆ ವಿವರ' },
  { en: 'Project report / cost estimate for the proposed business', kn: 'ಪ್ರಸ್ತಾವಿತ ವ್ಯಾಪಾರದ ಯೋಜನಾ ವರದಿ / ವೆಚ್ಚ ಅಂದಾಜು' },
  { en: 'Quotation(s) for equipment / raw material where applicable', kn: 'ಸಲಕರಣೆ / ಕಚ್ಚಾ ಸಾಮಗ್ರಿಗೆ ಉಲ್ಲೇಖ (ಅನ್ವಯಿಸಿದಂತೆ)' },
]

const MICRO_EXTRA: ChecklistItem[] = [
  { en: 'SHG / channel partner recommendation letter, if routed via SHG', kn: 'SHG ಮೂಲಕವಾದರೆ SHG / ಚಾನೆಲ್ ಪಾರ್ಟ್‌ನರ್ ಶಿಫಾರಸು ಪತ್ರ' },
]

const TERM_EXTRA: ChecklistItem[] = [
  { en: 'Collateral / guarantor details as required by the lending channel partner', kn: 'ಸಾಲ ನೀಡುವ ಚಾನೆಲ್ ಪಾರ್ಟ್‌ನರ್ ಅಗತ್ಯಪಡಿಸುವ ಜಾಮೀನು / ಖಾತರಿದಾರ ವಿವರ' },
  { en: 'Shop / establishment or business registration, if already operating', kn: 'ಈಗಾಗಲೇ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತಿದ್ದರೆ ಅಂಗಡಿ / ಸಂಸ್ಥೆ ನೋಂದಣಿ' },
  { en: 'Site / premises proof (owned or leased) for the proposed unit', kn: 'ಪ್ರಸ್ತಾವಿತ ಘಟಕಕ್ಕೆ ಸ್ಥಳ / ಆವರಣ ಪುರಾವೆ (ಸ್ವಂತ ಅಥವಾ ಬಾಡಿಗೆ)' },
]

export function getDocumentChecklist(schemeId: SchemeId): ChecklistItem[] {
  if (schemeId === 'micro_finance') return [...COMMON, ...MICRO_EXTRA]
  if (schemeId === 'term_loan') return [...COMMON, ...TERM_EXTRA]
  return COMMON
}
