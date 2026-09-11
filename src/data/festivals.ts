export interface FestivalEvent {
  id: string
  name: string
  nameKn: string
  villageIds: string[]
  startOffsetDays: number
  durationDays: number
  demandLift: Record<string, number>
  insight: string
  insightKn: string
  action: string
  actionKn: string
}

/** Relative to "today" so the demo always shows upcoming windows */
export const FESTIVAL_TEMPLATES: FestivalEvent[] = [
  {
    id: 'sulebhavi-basavanna',
    name: 'Sulebhavi Basavanna Jatra',
    nameKn: 'ಸುಳೆಭಾವಿ ಬಸವಣ್ಣ ಜಾತ್ರೆ',
    villageIds: ['sulebhavi-belagavi'],
    startOffsetDays: 4,
    durationDays: 3,
    demandLift: { food: 0.55, retail: 0.35, dairy: 0.22, textiles: 0.4 },
    insight:
      'Post-harvest cash is circulating. Devotees prefer sattvic / vegetarian meals; flower & sweet stalls spike.',
    insightKn:
      'ಕೊಯ್ಲು ನಂತರದ ನಗದು ಪರಿಚಲನೆಯಲ್ಲಿದೆ. ಭಕ್ತರು ಸಾತ್ವಿಕ/ಸಸ್ಯಾಹಾರಿ ಆಹಾರ ಬಯಸುತ್ತಾರೆ; ಹೂವು ಮತ್ತು ಸಿಹಿ ಅಂಗಡಿಗಳು ಏರುತ್ತವೆ.',
    action:
      'Prep 3 vegetarian combo meals + banana-leaf thali; pre-order milk & curd 48h early; hire 1 helper only for jatra days.',
    actionKn:
      '3 ಸಸ್ಯಾಹಾರಿ ಕಾಂಬೋ + ಬಾಳೆಎಲೆ ತಟ್ಟೆ ಸಿದ್ಧಪಡಿಸಿ; 48 ಗಂಟೆ ಮುಂಚಿತವಾಗಿ ಹಾಲು/ಮೊಸರು ಆರ್ಡರ್; ಜಾತ್ರೆ ದಿನಗಳಿಗೆ ಮಾತ್ರ 1 ಸಹಾಯಕ.',
  },
  {
    id: 'kabbenur-gramadevata',
    name: 'Kabbenur Gramadevata Jatra',
    nameKn: 'ಕಬ್ಬೇನೂರು ಗ್ರಾಮದೇವತಾ ಜಾತ್ರೆ',
    villageIds: ['kabbenur-dharwad'],
    startOffsetDays: 9,
    durationDays: 2,
    demandLift: { dairy: 0.28, food: 0.42, retail: 0.3, textiles: 0.25 },
    insight:
      'Village fair draws neighbouring taluks. Fresh curd, buttermilk and festival sweets move fast; raw milk alone leaves margin on table.',
    insightKn:
      'ಹತ್ತಿರದ ತಾಲೂಕುಗಳಿಂದ ಜನರು ಬರುತ್ತಾರೆ. ತಾಜಾ ಮೊಸರು, ಮಜ್ಜಿಗೆ, ಹಬ್ಬದ ಸಿಹಿಗಳು ವೇಗವಾಗಿ ಮಾರಾಟ; ಕಚ್ಚಾ ಹಾಲು ಮಾತ್ರ ಮಾರ್ಜಿನ್ ಕಳೆಯುತ್ತದೆ.',
    action:
      'Shift 30% milk into paneer & ghee kits priced for festival gifting; set stall near temple queue, not main road.',
    actionKn:
      '30% ಹಾಲನ್ನು ಪನೀರ್ ಮತ್ತು ತುಪ್ಪ ಕಿಟ್‌ಗೆ ಪರಿವರ್ತಿಸಿ; ಮುಖ್ಯ ರಸ್ತೆಯ ಬದಲು ದೇವಸ್ಥಾನ ಸರತಿ ಬಳಿ ಅಂಗಡಿ.',
  },
  {
    id: 'kunigal-ugadi-market',
    name: 'Kunigal Ugadi Market Week',
    nameKn: 'ಕುಣಿಗಲ್ ಯುಗಾದಿ ಮಾರುಕಟ್ಟೆ ವಾರ',
    villageIds: ['kunigal-tumakuru', 'dinka-mandya'],
    startOffsetDays: 14,
    durationDays: 5,
    demandLift: { retail: 0.45, textiles: 0.5, food: 0.38, dairy: 0.18 },
    insight:
      'Households restock clothes, oil, jaggery and snacks. Bengaluru weekend traffic lifts packaged dairy demand.',
    insightKn:
      'ಮನೆಗಳು ಬಟ್ಟೆ, ಎಣ್ಣೆ, ಬೆಲ್ಲ, ತಿಂಡಿ ಖರೀದಿಸುತ್ತವೆ. ಬೆಂಗಳೂರು ವಾರಾಂತ್ಯ ದಟ್ಟಣೆ ಪ್ಯಾಕೇಜ್ಡ್ ಹೈನು ಬೇಡಿಕೆ ಹೆಚ್ಚಿಸುತ್ತದೆ.',
    action:
      'Bundle “Ugadi kit” (ghee + curd + jaggery) with thin margin on oil to pull footfall; SMS offer to 50 regulars.',
    actionKn:
      'ಯುಗಾದಿ ಕಿಟ್ (ತುಪ್ಪ+ಮೊಸರು+ಬೆಲ್ಲ) ಕಟ್ಟಿ; ಎಣ್ಣೆಯಲ್ಲಿ ಕಡಿಮೆ ಮಾರ್ಜಿನ್‌ನಿಂದ ಗ್ರಾಹಕರನ್ನು ಸೆಳೆಯಿರಿ; 50 ನಿಯಮಿತರಿಗೆ SMS.',
  },
  {
    id: 'sakleshpur-monsoon-prep',
    name: 'Sakleshpur Monsoon Stock-up',
    nameKn: 'ಸಕಲೇಶಪುರ ಮುಂಗಾರು ಸ್ಟಾಕ್-ಅಪ್',
    villageIds: ['sakleshpur-hassan'],
    startOffsetDays: 6,
    durationDays: 8,
    demandLift: { agri_processing: 0.4, retail: 0.32, poultry: 0.2, food: 0.15 },
    insight:
      'Before heavy rains, households stock processed grains & snacks; road delays raise local processed food premiums.',
    insightKn:
      'ಭಾರೀ ಮಳೆಗೆ ಮುನ್ನ ಮನೆಗಳು ಸಂಸ್ಕೃತ ಧಾನ್ಯ/ತಿಂಡಿ ಸಂಗ್ರಹಿಸುತ್ತವೆ; ರಸ್ತೆ ವಿಳಂಬದಿಂದ ಸ್ಥಳೀಯ ಸಂಸ್ಕೃತ ಆಹಾರ ಬೆಲೆ ಏರುತ್ತದೆ.',
    action:
      'Pre-pack ragi malt & spice mixes; lock 7-day working capital for raw stock before rain warning peaks.',
    actionKn:
      'ರಾಗಿ ಮಾಲ್ಟ್ ಮತ್ತು ಮಸಾಲೆ ಮಿಶ್ರಣ ಪ್ಯಾಕ್ ಮಾಡಿ; ಮಳೆ ಎಚ್ಚರಿಕೆಗೆ ಮುನ್ನ 7 ದಿನದ ಕಚ್ಚಾ ಸ್ಟಾಕ್‌ಗೆ ಕಾರ್ಯ ಬಂಡವಾಳ ಲಾಕ್ ಮಾಡಿ.',
  },
]

export function getUpcomingEvents(villageId: string, from = new Date()) {
  return FESTIVAL_TEMPLATES.filter((e) => e.villageIds.includes(villageId)).map((e) => {
    const start = new Date(from)
    start.setDate(start.getDate() + e.startOffsetDays)
    const end = new Date(start)
    end.setDate(end.getDate() + e.durationDays - 1)
    return { ...e, start, end }
  })
}
