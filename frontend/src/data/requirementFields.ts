import type { DomainId } from '@/types'
import type { RequirementFieldDef } from '@/types/compatibility'

/**
 * Illustrative requirement fields per domain.
 *
 * `specLabels` lists the exact labels in a part record that each requirement
 * is allowed to read. Keep these to true synonyms: a label that only looks
 * similar must NOT be listed, otherwise the engine would compare unlike things.
 * Some fields (for example "Dynamic load rating", "Pinout" and the vehicle
 * make/model/year fitment) are deliberately not present in any demo record,
 * which shows how missing data is reported as Unverified.
 */
export const requirementFields: RequirementFieldDef[] = [
  /* ----------------------------- Industrial ----------------------------- */
  {
    id: 'ind.bore',
    domain: 'industrial',
    label: 'Bore diameter',
    kind: 'number-equals',
    input: 'number',
    unit: 'mm',
    specLabels: ['Bore diameter'],
    hint: 'Part value must equal this.',
    placeholder: 'e.g. 80',
  },
  {
    id: 'ind.pressure',
    domain: 'industrial',
    label: 'Operating pressure',
    kind: 'number-min',
    input: 'number',
    unit: 'bar',
    specLabels: ['Max pressure'],
    hint: 'Part’s maximum pressure rating must be at least this.',
    placeholder: 'e.g. 200',
  },
  {
    id: 'ind.speed',
    domain: 'industrial',
    label: 'Speed rating',
    kind: 'number-min',
    input: 'number',
    unit: 'rpm',
    specLabels: ['Max speed'],
    hint: 'Part’s maximum speed must be at least this.',
    placeholder: 'e.g. 2500',
  },
  {
    id: 'ind.load',
    domain: 'industrial',
    label: 'Dynamic load rating',
    kind: 'number-min',
    input: 'number',
    unit: 'kN',
    specLabels: ['Dynamic load rating'],
    hint: 'Part’s dynamic load rating must be at least this. No demo record lists it.',
    placeholder: 'e.g. 40',
  },
  {
    id: 'ind.sealing',
    domain: 'industrial',
    label: 'Sealing requirement (material)',
    kind: 'text-contains',
    input: 'text',
    specLabels: ['Seal material'],
    hint: 'Part’s seal material must include every term (comma-separated).',
    placeholder: 'e.g. NBR',
  },
  {
    id: 'ind.temperature',
    domain: 'industrial',
    label: 'Operating temperature',
    kind: 'number-within',
    input: 'number',
    unit: '°C',
    specLabels: ['Temperature range'],
    hint: 'This temperature must sit inside the part’s stated range.',
    placeholder: 'e.g. 60',
  },

  /* ----------------------------- Electronics ---------------------------- */
  {
    id: 'ele.package',
    domain: 'electronics',
    label: 'Package type',
    kind: 'text-equals',
    input: 'text',
    specLabels: ['Package'],
    hint: 'Part package must be identical (case, spaces and hyphens ignored).',
    placeholder: 'e.g. SOT-223',
  },
  {
    id: 'ele.pinout',
    domain: 'electronics',
    label: 'Pinout',
    kind: 'text-equals',
    input: 'text',
    specLabels: ['Pinout'],
    hint: 'Part pinout must be identical. No demo record lists it.',
    placeholder: 'e.g. 1-GND, 2-OUT, 3-IN',
  },
  {
    id: 'ele.supply',
    domain: 'electronics',
    label: 'Operating voltage',
    kind: 'number-within',
    input: 'number',
    unit: 'V',
    specLabels: ['Input voltage', 'Supply voltage'],
    hint: 'This voltage must sit inside the part’s stated input or supply range.',
    placeholder: 'e.g. 12',
  },
  {
    id: 'ele.voltageRating',
    domain: 'electronics',
    label: 'Voltage rating',
    kind: 'number-min',
    input: 'number',
    unit: 'V',
    specLabels: ['Voltage rating', 'Max input voltage', 'Drain-source voltage'],
    hint: 'Part’s maximum voltage rating must be at least this.',
    placeholder: 'e.g. 12',
  },
  {
    id: 'ele.current',
    domain: 'electronics',
    label: 'Current rating',
    kind: 'number-min',
    input: 'number',
    unit: 'A',
    specLabels: ['Current rating', 'Max output current', 'Output current', 'Continuous drain current'],
    hint: 'Part’s current rating must be at least this.',
    placeholder: 'e.g. 1',
  },

  /* ------------------------------ Automotive ---------------------------- */
  {
    id: 'aut.vehicle',
    domain: 'automotive',
    label: 'Vehicle make, model and year',
    kind: 'text-contains',
    input: 'text',
    specLabels: ['Fitment', 'Vehicle fitment'],
    hint: 'Needs a fitment record naming this vehicle. No demo record has one.',
    placeholder: 'e.g. Example Motors Zeta 2019',
  },
  {
    id: 'aut.class',
    domain: 'automotive',
    label: 'Vehicle class',
    kind: 'list-contains',
    input: 'select',
    specLabels: [],
    hint: 'Checks the part’s typical-application list only. This is not model-specific fitment.',
    options: ['Compact sedans', 'Small crossovers', 'Petrol hatchbacks', 'Light diesel vans'],
  },
  {
    id: 'aut.diameter',
    domain: 'automotive',
    label: 'Diameter',
    kind: 'number-equals',
    input: 'number',
    unit: 'mm',
    specLabels: ['Diameter', 'Outer diameter'],
    hint: 'Part diameter must equal this.',
    placeholder: 'e.g. 280',
  },
  {
    id: 'aut.thread',
    domain: 'automotive',
    label: 'Thread size',
    kind: 'text-equals',
    input: 'text',
    specLabels: ['Thread'],
    hint: 'Part thread must be identical (spaces and × / x ignored).',
    placeholder: 'e.g. M20 × 1.5',
  },
  {
    id: 'aut.axle',
    domain: 'automotive',
    label: 'Axle position',
    kind: 'text-equals',
    input: 'select',
    specLabels: ['Axle position'],
    hint: 'Application-specific: the part must be made for this axle.',
    options: ['Front', 'Rear'],
  },
]

export function fieldsForDomain(domain: DomainId): RequirementFieldDef[] {
  return requirementFields.filter((field) => field.domain === domain)
}
