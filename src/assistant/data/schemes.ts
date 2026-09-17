/**
 * Government Scheme Knowledge Base — v1 starter dataset.
 *
 * IMPORTANT: this is a MANUALLY CURATED, STATIC reference dataset, not a
 * live feed from any government system. It was assembled from publicly
 * published scheme guidelines as of each entry's `lastVerifiedDate` and can
 * go stale — official terms, caps and URLs change. Every scheme card in the
 * UI must show the source + lastVerifiedDate and tell the user to confirm
 * details with the official channel before acting on them.
 *
 * Only schemes whose names, official URLs, and eligibility structure are
 * well-documented public knowledge are included. Where a specific number
 * (e.g. an exact income ceiling) is genuinely scheme/sub-scheme dependent
 * and not safely reducible to one figure, the field is left undefined
 * rather than guessed — the eligibility engine treats "undefined" as "not
 * enough information to check this criterion", never as "no restriction
 * exists". See eligibility.ts.
 *
 * The two NSFDC entries deliberately reuse the numeric constants already
 * defined in src/lib/config.ts (NSFDC) and used by the existing, unmodified
 * /finance calculator — so this knowledge base can never drift from the
 * app's own real NSFDC math.
 */

import { NSFDC } from '../../lib/config'
import type { GovernmentScheme } from '../types'

export const KNOWLEDGE_BASE_META = {
  label: 'Maintained knowledge base (static reference data)',
  description:
    'Curated from publicly available central/state scheme guidelines. Not a live government data feed — always verify against the official source before applying.',
  lastReviewedDate: '2026-09-12',
}

export const SCHEMES: GovernmentScheme[] = [
  {
    id: 'nsfdc-micro-finance',
    name: 'NSFDC Micro Finance Scheme (MFS)',
    shortName: 'NSFDC MFS',
    description:
      'Micro-credit for small business/self-employment ventures for Scheduled Caste beneficiaries, routed through State Channelising Agencies (SCAs) or NSFDC-empanelled banks/NBFCs. This is the same NSFDC micro-finance structure this app\'s own /finance calculator uses for project costs up to the micro-project cap.',
    ministry: 'Ministry of Social Justice and Empowerment (National Scheduled Castes Finance and Development Corporation)',
    scope: 'central',
    eligibility: {
      socialCategories: ['sc'],
      maxAnnualIncome: 500_000,
      businessSectors: ['any'],
      notes:
        'Applicant must belong to a Scheduled Caste and route the application via the State Channelising Agency (SCA) in their state. Income ceiling shown here matches this app\'s existing NSFDC eligibility assumption.',
    },
    loanAmount: {
      maxRupees: NSFDC.microLoanCapRupees,
      notes: `Project cost capped at ₹${NSFDC.microProjectCapRupees.toLocaleString('en-IN')}; loan up to 90% of project cost, capped at ₹${NSFDC.microLoanCapRupees.toLocaleString('en-IN')}.`,
    },
    interest: {
      ratePercent: NSFDC.microRate,
      notes: `${NSFDC.microTenureYears}-year tenure with a ${NSFDC.microMoratoriumMonths}-month moratorium.`,
    },
    documents: [
      'Caste certificate (SC)',
      'Aadhaar card',
      'Income certificate',
      'Project report / cost estimate',
      'Bank account details',
      'Passport-size photographs',
    ],
    applicationSteps: [
      'Identify the State Channelising Agency (SCA) for NSFDC schemes in your state.',
      'Submit the loan application with the required documents to the SCA.',
      'SCA appraises the project and forwards it to NSFDC for sanction.',
      'On sanction, funds are released via the SCA / partner bank.',
    ],
    officialApplicationUrl: 'https://www.nsfdc.nic.in/',
    officialInfoUrl: 'https://www.nsfdc.nic.in/',
    source: 'NSFDC scheme guidelines',
    sourceUrl: 'https://www.nsfdc.nic.in/',
    lastVerifiedDate: '2026-09-12',
    confidence: 'reference',
    tags: ['sc', 'scheduled caste', 'micro finance', 'small loan', 'self employment', 'nsfdc'],
  },
  {
    id: 'nsfdc-term-loan',
    name: 'NSFDC Term Loan Scheme',
    shortName: 'NSFDC Term Loan',
    description:
      'Term loan financing for larger Scheduled Caste-owned business projects, routed through State Channelising Agencies. This mirrors the "term_loan" path in this app\'s own NSFDC /finance calculator.',
    ministry: 'Ministry of Social Justice and Empowerment (National Scheduled Castes Finance and Development Corporation)',
    scope: 'central',
    eligibility: {
      socialCategories: ['sc'],
      maxAnnualIncome: 500_000,
      businessSectors: ['any'],
      notes: 'Applicant must belong to a Scheduled Caste and route the application via the SCA in their state.',
    },
    loanAmount: {
      maxRupees: NSFDC.termLoanCapRupees,
      notes: `Project cost capped at ₹${(NSFDC.termProjectCapRupees / 100000).toFixed(0)} lakh; loan up to 90% of project cost, capped at ₹${(NSFDC.termLoanCapRupees / 100000).toFixed(1)} lakh.`,
    },
    interest: {
      ratePercent: NSFDC.termRate,
      notes: `${NSFDC.termTenureYears}-year tenure with a ${NSFDC.termMoratoriumMonths}-month moratorium.`,
    },
    documents: [
      'Caste certificate (SC)',
      'Aadhaar card',
      'Income certificate',
      'Detailed project report',
      'Bank account details',
      'Collateral / guarantor details as required by the channel partner',
    ],
    applicationSteps: [
      'Identify the State Channelising Agency (SCA) for NSFDC schemes in your state.',
      'Submit the loan application with a detailed project report to the SCA.',
      'SCA appraises and forwards the case to NSFDC for sanction.',
      'On sanction, funds are released via the SCA / partner bank in tranches.',
    ],
    officialApplicationUrl: 'https://www.nsfdc.nic.in/',
    officialInfoUrl: 'https://www.nsfdc.nic.in/',
    source: 'NSFDC scheme guidelines',
    sourceUrl: 'https://www.nsfdc.nic.in/',
    lastVerifiedDate: '2026-09-12',
    confidence: 'reference',
    tags: ['sc', 'scheduled caste', 'term loan', 'nsfdc', 'business loan'],
  },
  {
    id: 'pmegp',
    name: 'Prime Minister\'s Employment Generation Programme (PMEGP)',
    shortName: 'PMEGP',
    description:
      'Credit-linked subsidy scheme for setting up new micro-enterprises in the manufacturing or service sector, implemented by KVIC, KVIBs and District Industries Centres.',
    ministry: 'Ministry of Micro, Small and Medium Enterprises (via KVIC)',
    scope: 'central',
    eligibility: {
      minAge: 18,
      businessSectors: ['any'],
      excludedBusinessSectors: ['poultry', 'meat_processing', 'liquor', 'tobacco'],
      businessStages: ['idea', 'new'],
      minEducationNote:
        'At least Class VIII pass required for projects above ₹10 lakh (manufacturing) or ₹5 lakh (service).',
      notes:
        'For a new unit only — an existing/already-operating unit is generally not eligible for PMEGP margin-money subsidy on that unit. PMEGP\'s standard negative list excludes meat/poultry-farming, liquor and tobacco-based activities.',
    },
    loanAmount: {
      maxRupees: 5_000_000,
      notes:
        'Project cost up to ₹50 lakh for manufacturing units and ₹20 lakh for service-sector units (bank term loan + working capital).',
    },
    subsidy: {
      description:
        'Margin money subsidy of 15–35% of the project cost, higher for rural areas and for special categories (SC/ST/OBC/women/ex-servicemen/PwD/NER/border areas).',
      ratePercentMin: 15,
      ratePercentMax: 35,
    },
    documents: [
      'Aadhaar card',
      'Project report / detailed project report (DPR)',
      'Education qualification proof',
      'Caste/category certificate, if applicable',
      'Passport-size photographs',
      'Bank account details',
    ],
    applicationSteps: [
      'Register and apply online on the PMEGP e-portal (KVIC).',
      'Select the implementing agency (KVIC / KVIB / DIC) for your area.',
      'Attend the interview/selection process at the district level task force committee.',
      'Complete the mandatory Entrepreneurship Development Programme (EDP) training.',
      'On approval, the bank releases the loan and the margin-money subsidy is credited after the EDP.',
    ],
    officialApplicationUrl: 'https://www.kviconline.gov.in/pmegp/',
    officialInfoUrl: 'https://www.kviconline.gov.in/pmegp/',
    source: 'KVIC PMEGP guidelines',
    sourceUrl: 'https://www.kviconline.gov.in/pmegp/',
    lastVerifiedDate: '2026-09-12',
    confidence: 'reference',
    tags: ['pmegp', 'kvic', 'new business', 'manufacturing', 'service enterprise', 'subsidy'],
  },
  {
    id: 'pm-mudra-yojana',
    name: 'Pradhan Mantri Mudra Yojana (PMMY)',
    shortName: 'Mudra Yojana',
    description:
      'Collateral-free institutional credit up to ₹20 lakh for non-farm income-generating micro/small enterprises in manufacturing, trading, services, and activities allied to agriculture (e.g. poultry, dairy, beekeeping). Loans are categorised as Shishu, Kishor, Tarun and Tarun Plus by ticket size.',
    ministry: 'Ministry of Finance (Micro Units Development & Refinance Agency Ltd.)',
    scope: 'central',
    eligibility: {
      businessSectors: ['any'],
      businessStages: ['idea', 'new', 'existing_expansion'],
      notes:
        'No caste, income or gender restriction is prescribed by MUDRA itself, though the lending bank/NBFC applies its own standard credit appraisal. Explicitly covers activities allied to agriculture such as poultry, dairy and beekeeping, in addition to manufacturing, trading and services.',
    },
    loanAmount: {
      minRupees: 0,
      maxRupees: 2_000_000,
      notes:
        'Shishu: up to ₹50,000. Kishor: ₹50,001–₹5 lakh. Tarun: ₹5,00,001–₹10 lakh. Tarun Plus (for prior Tarun borrowers with a good repayment record): up to ₹20 lakh.',
    },
    documents: [
      'Aadhaar card',
      'Business plan / project proposal',
      'Proof of business existence, if already operating',
      'Bank account details',
      'Passport-size photographs',
    ],
    applicationSteps: [
      'Approach a participating bank, NBFC, MFI or apply online via the Udyamimitra/Jan Samarth portal.',
      'Submit the Mudra loan application form with the project proposal.',
      'Bank appraises the proposal under Shishu/Kishor/Tarun/Tarun Plus as applicable.',
      'On sanction, the loan is disbursed along with a Mudra Card for working capital drawdown.',
    ],
    officialApplicationUrl: 'https://www.jansamarth.in/',
    officialInfoUrl: 'https://www.mudra.org.in/',
    source: 'MUDRA (Ministry of Finance) scheme guidelines',
    sourceUrl: 'https://www.mudra.org.in/',
    lastVerifiedDate: '2026-09-12',
    confidence: 'reference',
    tags: [
      'mudra',
      'shishu',
      'kishor',
      'tarun',
      'collateral free loan',
      'poultry',
      'dairy',
      'small business',
      'expansion',
    ],
  },
  {
    id: 'stand-up-india',
    name: 'Stand-Up India',
    shortName: 'Stand-Up India',
    description:
      'Bank loans of ₹10 lakh to ₹1 crore for setting up a new (greenfield) enterprise in manufacturing, services, trading or activities allied to agriculture, for at least one Scheduled Caste/Scheduled Tribe borrower or one woman borrower per bank branch.',
    ministry: 'Department of Financial Services, Ministry of Finance',
    scope: 'central',
    eligibility: {
      minAge: 18,
      businessSectors: ['any'],
      businessStages: ['idea', 'new'],
      requiresGreenfield: true,
      eligibleIfAny: [{ socialCategories: ['sc', 'st'] }, { genders: ['female'] }],
      notes:
        'Meant for a first-time (greenfield) enterprise, not for expanding an existing business. Eligible if the applicant is SC, ST, or a woman.',
    },
    loanAmount: {
      minRupees: 1_000_000,
      maxRupees: 100_000_000,
      notes: 'Composite loan (term loan + working capital) between ₹10 lakh and ₹1 crore.',
    },
    documents: [
      'Aadhaar card',
      'Caste certificate, if applying under SC/ST category',
      'Detailed project report / business plan',
      'Identity and address proof',
      'Bank account details',
    ],
    applicationSteps: [
      'Apply online via the Stand-Up India portal or approach a scheduled commercial bank branch directly.',
      'Submit the project report and required documents for appraisal.',
      'Bank appraises the greenfield project for viability and sanctions the composite loan.',
      'Handholding support is available through the Stand-Up India portal\'s support agencies.',
    ],
    officialApplicationUrl: 'https://www.standupmitra.in/',
    officialInfoUrl: 'https://www.standupmitra.in/',
    source: 'Stand-Up India scheme guidelines',
    sourceUrl: 'https://www.standupmitra.in/',
    lastVerifiedDate: '2026-09-12',
    confidence: 'reference',
    tags: ['stand up india', 'sc', 'st', 'women entrepreneur', 'greenfield', 'new enterprise', 'bank loan'],
  },
  {
    id: 'pm-vishwakarma',
    name: 'PM Vishwakarma',
    shortName: 'PM Vishwakarma',
    description:
      'Support for traditional artisans and craftspeople working with their hands and tools across 18 specified trades (including tailors/Darzi, carpenters, blacksmiths, potters, cobblers and others), covering recognition, skill training, toolkit incentive, and collateral-free credit.',
    ministry: 'Ministry of Micro, Small and Medium Enterprises',
    scope: 'central',
    eligibility: {
      minAge: 18,
      businessSectors: ['traditional_crafts', 'tailoring', 'carpentry', 'blacksmithing', 'pottery', 'handicraft'],
      notes:
        'Applicant must be engaged in one of the 18 PM Vishwakarma trades through a family-based or hereditary occupation. Tailoring (Darzi) is one of the listed trades.',
    },
    loanAmount: {
      maxRupees: 300_000,
      notes:
        'Collateral-free Enterprise Development Loan: first tranche up to ₹1 lakh (repayable over 18 months), second tranche up to ₹2 lakh (repayable over 30 months) after satisfactory use of the first.',
    },
    interest: {
      ratePercent: 5,
      notes: 'Concessional 5% interest rate; the government subvenes the balance of the applicable rate.',
    },
    subsidy: {
      description: 'One-time toolkit incentive of up to ₹15,000 (as e-vouchers) plus a skill-training stipend.',
    },
    documents: [
      'Aadhaar card',
      'Proof of trade / traditional occupation',
      'Bank account details',
      'Passport-size photographs',
    ],
    applicationSteps: [
      'Register free of cost via a Common Service Centre (CSC) or the PM Vishwakarma portal.',
      'Get verified by the local body / gram panchayat and district-level implementing agency.',
      'Complete basic skilling; opt for advanced skilling if desired.',
      'Receive the PM Vishwakarma certificate/ID, toolkit incentive, and apply for the first loan tranche.',
    ],
    officialApplicationUrl: 'https://pmvishwakarma.gov.in/',
    officialInfoUrl: 'https://pmvishwakarma.gov.in/',
    source: 'PM Vishwakarma scheme guidelines',
    sourceUrl: 'https://pmvishwakarma.gov.in/',
    lastVerifiedDate: '2026-09-12',
    confidence: 'reference',
    tags: ['pm vishwakarma', 'artisan', 'craftsperson', 'tailor', 'darzi', 'toolkit', 'traditional trade'],
  },
  {
    id: 'nbcfdc-term-loan',
    name: 'NBCFDC Term Loan Scheme',
    shortName: 'NBCFDC Term Loan',
    description:
      'Concessional term-loan finance for income-generating self-employment ventures for Other Backward Classes (OBC) and Economically Backward Classes (EBC) beneficiaries, routed through State Channelising Agencies.',
    ministry: 'Ministry of Social Justice and Empowerment (National Backward Classes Finance and Development Corporation)',
    scope: 'central',
    eligibility: {
      socialCategories: ['obc'],
      businessSectors: ['any'],
      notes:
        'Exact income ceiling and loan slab depend on the specific NBCFDC scheme variant and are set by the State Channelising Agency (SCA) — confirm current limits with your state SCA before applying. Not modelled here as a fixed number to avoid overstating precision.',
    },
    loanAmount: {
      notes:
        'Ticket size varies by scheme variant and SCA; typically small/medium-ticket term loans for self-employment. Confirm the current slab with your SCA.',
    },
    documents: [
      'OBC / EBC caste certificate',
      'Income certificate',
      'Aadhaar card',
      'Project report / cost estimate',
      'Bank account details',
    ],
    applicationSteps: [
      'Identify the State Channelising Agency (SCA) for NBCFDC schemes in your state.',
      'Submit the loan application with required documents to the SCA.',
      'SCA appraises and forwards the case to NBCFDC for sanction.',
      'On sanction, funds are released via the SCA / partner bank.',
    ],
    officialApplicationUrl: 'https://www.nbcfdc.gov.in/',
    officialInfoUrl: 'https://www.nbcfdc.gov.in/',
    source: 'NBCFDC scheme guidelines',
    sourceUrl: 'https://www.nbcfdc.gov.in/',
    lastVerifiedDate: '2026-09-12',
    confidence: 'reference',
    tags: ['obc', 'backward classes', 'nbcfdc', 'term loan', 'self employment'],
  },
  {
    id: 'kudumbashree-microenterprise',
    name: 'Kudumbashree Microenterprise Support',
    shortName: 'Kudumbashree',
    description:
      'Kerala\'s State Poverty Eradication Mission supports women, organised into Neighbourhood Groups (NHGs), to set up and run individual or group microenterprises — including common categories such as tailoring units, food units and retail — with training, subsidy linkage and bank credit facilitation.',
    ministry: 'Government of Kerala (Kudumbashree — State Poverty Eradication Mission)',
    scope: 'state',
    state: 'Kerala',
    eligibility: {
      states: ['Kerala'],
      genders: ['female'],
      businessSectors: ['any'],
      notes:
        'Open to women in Kerala, typically through membership in a Kudumbashree Neighbourhood Group (NHG); both rural and urban units operate. Exact subsidy/loan amount depends on the specific microenterprise scheme routed through Kudumbashree at the time of application.',
    },
    loanAmount: {
      notes: 'Varies by the specific microenterprise/bank-linkage scheme in effect — confirm current terms with your local Kudumbashree unit.',
    },
    documents: [
      'Kudumbashree NHG membership details',
      'Aadhaar card',
      'Ration card / local resident proof',
      'Business plan for the proposed microenterprise',
      'Bank account details',
    ],
    applicationSteps: [
      'Join or confirm membership in a local Kudumbashree Neighbourhood Group (NHG).',
      'Discuss the microenterprise idea with the NHG/Area Development Society for endorsement.',
      'Apply for the relevant microenterprise/bank-linkage support through the Community Development Society (CDS).',
      'Complete any required training, then proceed to bank loan sanction and unit setup.',
    ],
    officialApplicationUrl: 'https://www.kudumbashree.org/',
    officialInfoUrl: 'https://www.kudumbashree.org/',
    source: 'Kudumbashree (Government of Kerala) programme information',
    sourceUrl: 'https://www.kudumbashree.org/',
    lastVerifiedDate: '2026-09-12',
    confidence: 'reference',
    tags: ['kudumbashree', 'kerala', 'women entrepreneur', 'tailoring', 'microenterprise', 'nhg'],
  },
]
