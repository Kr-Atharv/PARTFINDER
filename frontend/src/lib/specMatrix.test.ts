import { describe, expect, it } from 'vitest'
import { buildSpecMatrix, keyDifferences, numericExtremes } from '@/lib/specMatrix'
import { makePart } from '@/test/fixtures'

const cell = (partId: string, value: string) => ({ partId, value })

describe('numericExtremes', () => {
  it('finds highest and lowest for same-unit numbers', () => {
    expect(numericExtremes([cell('a', '80 mm'), cell('b', '100 mm'), cell('c', '90 mm')])).toEqual({ highest: ['b'], lowest: ['a'] })
  })

  it('converts compatible units before comparing', () => {
    // 10 cm = 100 mm, so b is highest
    expect(numericExtremes([cell('a', '80 mm'), cell('b', '10 cm')])).toEqual({ highest: ['b'], lowest: ['a'] })
  })

  it('reports ties on both ends', () => {
    expect(numericExtremes([cell('a', '5 V'), cell('b', '5 V'), cell('c', '12 V')])).toEqual({ highest: ['c'], lowest: ['a', 'b'] })
  })

  it('compares unitless numbers', () => {
    expect(numericExtremes([cell('a', '4'), cell('b', '8')])).toEqual({ highest: ['b'], lowest: ['a'] })
  })

  it('refuses to guess for ranges, text, mixed families or unknown units', () => {
    expect(numericExtremes([cell('a', '4.5-28 V'), cell('b', '5 V')])).toBeUndefined()
    expect(numericExtremes([cell('a', 'NBR'), cell('b', 'FKM')])).toBeUndefined()
    expect(numericExtremes([cell('a', '80 mm'), cell('b', '250 bar')])).toBeUndefined()
    expect(numericExtremes([cell('a', '5 widgets'), cell('b', '6 widgets')])).toBeUndefined()
    expect(numericExtremes([cell('a', '5 V'), cell('b', '6')])).toBeUndefined()
  })

  it('returns nothing when all values are equal or fewer than two are listed', () => {
    expect(numericExtremes([cell('a', '80 mm'), cell('b', '8 cm')])).toBeUndefined()
    expect(numericExtremes([cell('a', '80 mm')])).toBeUndefined()
  })
})

describe('buildSpecMatrix / keyDifferences', () => {
  const a = makePart({ id: 'a', specs: [{ label: 'Bore diameter', value: '80 mm' }, { label: 'Material', value: 'NBR' }, { label: 'Weight', value: '1 kg' }] })
  const b = makePart({ id: 'b', specs: [{ label: 'bore  diameter', value: '100 mm' }, { label: 'Material', value: 'NBR' }] })

  it('lines up labels case/space-insensitively and classifies rows', () => {
    const matrix = buildSpecMatrix([a, b])
    const bore = matrix.rows.find((row) => row.label === 'Bore diameter')!
    expect(bore.status).toBe('differs')
    expect(bore.extremes).toEqual({ highest: ['b'], lowest: ['a'] })
    expect(matrix.rows.find((row) => row.label === 'Material')!.status).toBe('same')
    const weight = matrix.rows.find((row) => row.label === 'Weight')!
    expect(weight.status).toBe('gap')
    expect(weight.cells.find((c) => c.partId === 'b')!.value).toBeNull()
    expect(weight.extremes).toBeUndefined()
  })

  it('keyDifferences lists only differing rows and omits parts that do not list the spec', () => {
    const diffs = keyDifferences(buildSpecMatrix([a, b]))
    expect(diffs).toHaveLength(1)
    expect(diffs[0].label).toBe('Bore diameter')
    expect(diffs[0].values).toEqual([cell('a', '80 mm'), cell('b', '100 mm')])
  })

  it('respects the limit', () => {
    const many = (id: string, v: string) =>
      makePart({ id, specs: Array.from({ length: 10 }, (_, i) => ({ label: `S${i}`, value: `${v}${i}` })) })
    expect(keyDifferences(buildSpecMatrix([many('x', 'a'), many('y', 'b')]), 3)).toHaveLength(3)
  })
})
