/**
 * Minimal, explicit quantity parsing for spec values such as "80 mm",
 * "-30 to 100 °C" or "4.5-28 V". Only the units listed below are understood;
 * anything else is reported as unknown rather than guessed.
 */

interface UnitInfo {
  family: string
  /** Multiply by this to reach the family's base unit. */
  factor: number
}

const UNITS: Record<string, UnitInfo> = {
  mm: { family: 'length', factor: 1 },
  cm: { family: 'length', factor: 10 },
  m: { family: 'length', factor: 1000 },
  in: { family: 'length', factor: 25.4 },
  bar: { family: 'pressure', factor: 1 },
  kPa: { family: 'pressure', factor: 0.01 },
  MPa: { family: 'pressure', factor: 10 },
  psi: { family: 'pressure', factor: 0.0689476 },
  V: { family: 'voltage', factor: 1 },
  mV: { family: 'voltage', factor: 0.001 },
  kV: { family: 'voltage', factor: 1000 },
  A: { family: 'current', factor: 1 },
  mA: { family: 'current', factor: 0.001 },
  W: { family: 'power', factor: 1 },
  kW: { family: 'power', factor: 1000 },
  rpm: { family: 'speed', factor: 1 },
  '°C': { family: 'temperature', factor: 1 },
  N: { family: 'force', factor: 1 },
  kN: { family: 'force', factor: 1000 },
}

export interface Quantity {
  min: number
  max: number
  /** True when the source text gave a range ("4.5-28 V"). */
  isRange: boolean
  /** The unit token as written, or '' when none followed the number. */
  unit: string
}

const NUM = '[-+]?\\d+(?:\\.\\d+)?'
const QUANTITY = new RegExp(`^\\s*(${NUM})\\s*(?:(?:to|[-–—])\\s*(${NUM}))?\\s*([^\\s,;]*)`, 'i')

/** Reads the leading quantity of a value. Returns null if it does not start with a number. */
export function parseQuantity(raw: string): Quantity | null {
  // "3,000 rpm" -> "3000 rpm" (only exact thousands groups).
  const cleaned = raw.replace(/(\d),(\d{3})(?!\d)/g, '$1$2').replace('℃', '°C')
  const match = QUANTITY.exec(cleaned)
  if (!match) return null
  const first = Number(match[1])
  const second = match[2] !== undefined ? Number(match[2]) : undefined
  if (!Number.isFinite(first) || (second !== undefined && !Number.isFinite(second))) return null
  const low = second === undefined ? first : Math.min(first, second)
  const high = second === undefined ? first : Math.max(first, second)
  return { min: low, max: high, isRange: second !== undefined && second !== first, unit: match[3] }
}

export function isKnownUnit(unit: string): boolean {
  return unit in UNITS
}

/**
 * Converts a value to the family's base unit. Returns null when the unit is
 * unknown or belongs to a different family than `expectedUnit`.
 */
export function toBase(value: number, unit: string, expectedUnit: string): number | null {
  const from = UNITS[unit]
  const to = UNITS[expectedUnit]
  if (!from || !to || from.family !== to.family) return null
  return value * from.factor
}

/** Equality with a tiny relative tolerance to absorb unit-conversion rounding. */
export function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 + 1e-6 * Math.max(Math.abs(a), Math.abs(b))
}
