import { describe, expect, it } from 'vitest'
import { emptyRefinements, hasRefinements, matchRefinements } from '@/lib/search'
import { buildSearchParams, paramsToRefinements } from '@/lib/validation'
import type { Part, SearchCriteria, SearchRefinements } from '@/types'

const mockPart: Part = {
  id: 'test-1',
  partNumber: 'VLV-4402',
  name: 'High Pressure Hydraulic Control Valve',
  manufacturer: 'Parker Hannifin',
  category: 'Valves',
  domain: 'industrial',
  description: 'Precision hydraulic cartridge valve with viton seals',
  availability: 'in_stock',
  usedIn: ['Excavator 320D', 'Loader 950H'],
  keywords: ['valve', 'hydraulic'],
  specs: [
    { label: 'Max Pressure', value: '350 bar' },
    { label: 'Flow Rate', value: '45 L/min' },
    { label: 'Operating Temperature', value: '-20 to 120 °C' },
    { label: 'Port Size', value: 'G 3/8"' },
    { label: 'Thread Size', value: '3/4-16 UNF' },
    { label: 'Material', value: 'Stainless Steel 316' },
    { label: 'Diameter', value: '25 mm' },
    { label: 'Weight', value: '480 g' },
  ],
  source: { name: 'Parker Official Store', url: 'https://parker.com/parts/vlv4402' },
  verificationTier: 'official_manufacturer',
  location: 'Cleveland, OH, USA',
  price: { amount: 285.5, currencyKey: 'USD', raw: '$285.50', evidence: '$285.50', sourceUrl: 'https://parker.com/parts/vlv4402' },
  isDemo: false,
}

const motorPart: Part = {
  id: 'test-2',
  partNumber: 'MTR-8810',
  name: 'Brushless DC Servo Motor',
  manufacturer: 'Maxon',
  category: 'Motors',
  domain: 'electronics',
  description: 'High efficiency BLDC motor with hall sensors',
  availability: 'in_stock',
  usedIn: ['Robotic Arm X1', 'AGV Carrier'],
  keywords: ['motor', 'bldc'],
  specs: [
    { label: 'Nominal Voltage', value: '24 V' },
    { label: 'Continuous Current', value: '5 A' },
    { label: 'Power Rating', value: '120 W' },
    { label: 'Max Speed', value: '6000 RPM' },
    { label: 'Tolerance', value: 'h6 / ±0.005mm' },
    { label: 'Shaft Diameter', value: '8 mm' },
  ],
  source: { name: 'Mouser Electronics', url: 'https://mouser.com/part/mtr8810' },
  verificationTier: 'authorized_distributor',
  location: 'Mansfield, TX, USA',
  price: { amount: 154.0, currencyKey: 'USD', raw: '$154.00', evidence: '$154.00', sourceUrl: 'https://mouser.com/part/mtr8810' },
  isDemo: false,
}

describe('Detailed Technical Specification Filters', () => {
  it('detects active detailed specification refinements in hasRefinements', () => {
    expect(hasRefinements(emptyRefinements)).toBe(false)

    expect(
      hasRefinements({
        ...emptyRefinements,
        specs: { material: 'Steel' },
      }),
    ).toBe(true)

    expect(
      hasRefinements({
        ...emptyRefinements,
        specs: { pressure: { min: 100, max: 400, unit: 'bar' } },
      }),
    ).toBe(true)
  })

  it('filters by category-aware numeric ranges (pressure, flow rate, diameter)', () => {
    // Within range 200 - 400 bar -> matches 350 bar
    const matched = matchRefinements([mockPart, motorPart], {
      ...emptyRefinements,
      specs: { pressure: { min: 200, max: 400, unit: 'bar' } },
    })
    expect(matched.map((p) => p.id)).toEqual(['test-1'])

    // Out of range (too high)
    const outOfRange = matchRefinements([mockPart, motorPart], {
      ...emptyRefinements,
      specs: { pressure: { min: 400, max: 500, unit: 'bar' } },
    })
    expect(outOfRange).toHaveLength(0)

    // Diameter match: 20 to 30 mm
    const diameterMatch = matchRefinements([mockPart, motorPart], {
      ...emptyRefinements,
      specs: { diameter: { min: 20, max: 30, unit: 'mm' } },
    })
    expect(diameterMatch.map((p) => p.id)).toEqual(['test-1'])
  })

  it('filters by electrical properties (voltage, current, power, speed)', () => {
    // Voltage 12V to 30V
    const voltMatch = matchRefinements([mockPart, motorPart], {
      ...emptyRefinements,
      specs: { voltage: { min: 12, max: 30, unit: 'V' } },
    })
    expect(voltMatch.map((p) => p.id)).toEqual(['test-2'])

    // Power 100W to 200W
    const powerMatch = matchRefinements([mockPart, motorPart], {
      ...emptyRefinements,
      specs: { power: { min: 100, max: 200, unit: 'W' } },
    })
    expect(powerMatch.map((p) => p.id)).toEqual(['test-2'])

    // Speed 5000 to 7000 RPM
    const speedMatch = matchRefinements([mockPart, motorPart], {
      ...emptyRefinements,
      specs: { speed: { min: 5000, max: 7000 } },
    })
    expect(speedMatch.map((p) => p.id)).toEqual(['test-2'])
  })

  it('filters by partial specifications when exact part number is unknown (material, port size, thread)', () => {
    // Partial material: "316"
    const matMatch = matchRefinements([mockPart, motorPart], {
      ...emptyRefinements,
      specs: { material: '316' },
    })
    expect(matMatch.map((p) => p.id)).toEqual(['test-1'])

    // Partial port size: "3/8"
    const portMatch = matchRefinements([mockPart, motorPart], {
      ...emptyRefinements,
      specs: { portSize: '3/8' },
    })
    expect(portMatch.map((p) => p.id)).toEqual(['test-1'])

    // Compatible machine model: "320D"
    const compMatch = matchRefinements([mockPart, motorPart], {
      ...emptyRefinements,
      specs: { compatibleModel: '320D' },
    })
    expect(compMatch.map((p) => p.id)).toEqual(['test-1'])

    // Tolerance: "h6"
    const tolMatch = matchRefinements([mockPart, motorPart], {
      ...emptyRefinements,
      specs: { tolerance: 'h6' },
    })
    expect(tolMatch.map((p) => p.id)).toEqual(['test-2'])
  })

  it('filters by availability and warehouse location', () => {
    const locMatch = matchRefinements([mockPart, motorPart], {
      ...emptyRefinements,
      specs: { location: 'Cleveland' },
    })
    expect(locMatch.map((p) => p.id)).toEqual(['test-1'])
  })

  it('serializes and deserializes detailed specification filters in URL parameters', () => {
    const sampleCriteria: SearchCriteria = { query: 'valve', domain: 'industrial', manufacturer: '', model: '' }
    const refinements: SearchRefinements = {
      category: 'Valves',
      availability: 'in_stock',
      specLabel: '',
      specValue: '',
      specs: {
        material: 'Stainless Steel 316',
        pressure: { min: 100, max: 400, unit: 'bar' },
        portSize: 'G 3/8',
        location: 'Cleveland',
      },
    }

    const params = buildSearchParams(sampleCriteria, refinements, { page: 1, pageSize: 20, sort: 'name-asc' })
    const parsedRefinements = paramsToRefinements(params)

    expect(parsedRefinements.category).toBe('Valves')
    expect(parsedRefinements.availability).toBe('in_stock')
    expect(parsedRefinements.specs?.material).toBe('Stainless Steel 316')
    expect(parsedRefinements.specs?.pressure).toEqual({ min: 100, max: 400, unit: 'bar' })
    expect(parsedRefinements.specs?.portSize).toBe('G 3/8')
    expect(parsedRefinements.specs?.location).toBe('Cleveland')
  })
})
