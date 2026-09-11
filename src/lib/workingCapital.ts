import type { BusinessCategory } from '../data/villages'
import { WC_CYCLE_MONTHS, WC_OPEX_SPLIT } from './config'
import { fromPaise, toPaise } from './finance'

export interface WorkingCapitalPlan {
  category: BusinessCategory
  cycleMonths: number
  monthlyOpex: number
  lineItems: {
    rawMaterial: number
    labour: number
    utilities: number
    transportRent: number
  }
  workingCapital: number
  assumptionEn: string
  assumptionKn: string
}

/**
 * working_capital = monthly_operating_cost × wc_cycle_months[category]
 * Monthly opex defaults from scheme plan when provided; else % of project cost.
 */
export function buildWorkingCapital(input: {
  category: BusinessCategory
  projectCostRupees: number
  monthlyOpexRupees?: number
}): WorkingCapitalPlan {
  const cycleMonths = WC_CYCLE_MONTHS[input.category]
  const monthlyOpexPaise =
    input.monthlyOpexRupees != null
      ? toPaise(input.monthlyOpexRupees)
      : Math.round(toPaise(input.projectCostRupees) * 0.04)

  const lineItemsPaise = {
    rawMaterial: Math.round(monthlyOpexPaise * WC_OPEX_SPLIT.rawMaterial),
    labour: Math.round(monthlyOpexPaise * WC_OPEX_SPLIT.labour),
    utilities: Math.round(monthlyOpexPaise * WC_OPEX_SPLIT.utilities),
    transportRent: Math.round(monthlyOpexPaise * WC_OPEX_SPLIT.transportRent),
  }
  // Fix residue into raw material so line items sum to monthly opex
  const sumLines =
    lineItemsPaise.rawMaterial +
    lineItemsPaise.labour +
    lineItemsPaise.utilities +
    lineItemsPaise.transportRent
  lineItemsPaise.rawMaterial += monthlyOpexPaise - sumLines

  const wcPaise = Math.round(monthlyOpexPaise * cycleMonths)

  return {
    category: input.category,
    cycleMonths,
    monthlyOpex: fromPaise(monthlyOpexPaise),
    lineItems: {
      rawMaterial: fromPaise(lineItemsPaise.rawMaterial),
      labour: fromPaise(lineItemsPaise.labour),
      utilities: fromPaise(lineItemsPaise.utilities),
      transportRent: fromPaise(lineItemsPaise.transportRent),
    },
    workingCapital: fromPaise(wcPaise),
    assumptionEn: `Holds ${cycleMonths} month(s) of operating cost for ${input.category} (raw ${WC_OPEX_SPLIT.rawMaterial * 100}% · labour ${WC_OPEX_SPLIT.labour * 100}% · utilities ${WC_OPEX_SPLIT.utilities * 100}% · transport/rent ${WC_OPEX_SPLIT.transportRent * 100}%).`,
    assumptionKn: `${input.category} ಗೆ ${cycleMonths} ತಿಂಗಳ ಕಾರ್ಯಾಚರಣೆ ವೆಚ್ಚವನ್ನು ಕಾರ್ಯ ಬಂಡವಾಳವಾಗಿ ಇರಿಸಲಾಗಿದೆ.`,
  }
}
