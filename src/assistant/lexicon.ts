/**
 * Shared vocabulary for profile extraction, retrieval and eligibility
 * matching. Kept in one place so the sector tag a user's message extracts
 * to is guaranteed to be the same tag the scheme dataset and eligibility
 * engine compare against.
 */

export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Puducherry',
  'Chandigarh',
]

/** Sector tag -> keywords that indicate it in free text. Order matters: more specific first. */
export const SECTOR_KEYWORDS: Record<string, string[]> = {
  poultry: ['poultry', 'chicken farm', 'chicken business', 'hatchery', 'broiler', 'egg business', 'egg farm'],
  dairy: ['dairy', 'milk business', 'milk dairy', 'cow farm', 'buffalo farm'],
  tailoring: ['tailoring', 'tailor', 'stitching', 'boutique', 'garment making', 'sewing'],
  handicraft: ['handicraft', 'handicrafts', 'artisan work', 'craft business'],
  carpentry: ['carpentry', 'carpenter', 'furniture making', 'woodwork'],
  blacksmithing: ['blacksmith', 'ironwork', 'metalwork'],
  pottery: ['pottery', 'potter', 'terracotta'],
  food_processing: ['food processing', 'papad', 'pickle making', 'bakery', 'catering', 'snacks business', 'food unit'],
  textiles: ['textile', 'weaving', 'handloom', 'sari business'],
  retail: ['retail shop', 'retail business', 'retail store', 'kirana', 'grocery store', 'grocery', 'general store', 'shop business'],
  trading: ['trading business', 'wholesale', 'distributor'],
  manufacturing: ['manufacturing', 'factory', 'production unit'],
  services: ['repair shop', 'salon', 'beauty parlour', 'service business'],
}

export function normalizeSectorLabel(sector: string): string {
  return sector.replace(/_/g, ' ')
}
