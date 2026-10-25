// src/services/advancedFeatures.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { scanPartImage } from './visionService'
import { lookupEquivalents, getEquivalentsForPart } from './crossReferenceService'
import { parsePdfDatasheet } from './datasheetService'

describe('1. Vision OCR Service (Frontend)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends base64 image and returns extracted part details', async () => {
    const mockResponse = {
      data: {
        detectedText: 'PARKER D1VW 350 bar',
        confidence: 0.95,
        extracted: {
          manufacturer: 'Parker Hannifin',
          partNumber: 'D1VW',
          specs: [{ label: 'Max Pressure', value: '350 BAR', confidence: 0.95 }],
        },
        suggestedSearchQuery: 'Parker D1VW',
        source: 'nameplate_ai_engine',
      },
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }))),
    )

    const result = await scanPartImage({ manualText: 'PARKER D1VW' })
    expect(result.extracted.partNumber).toBe('D1VW')
    expect(result.extracted.manufacturer).toBe('Parker Hannifin')
    expect(result.extracted.specs[0].label).toBe('Max Pressure')
  })
})

describe('2. Cross-Reference Service (Frontend)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('requests equivalent parts and maps FFF scores', async () => {
    const mockResponse = {
      data: {
        sourcePart: { partNumber: '6205-2RS', standardSeries: 'ISO 15' },
        equivalentsCount: 2,
        equivalents: [
          {
            id: 'equiv-1',
            partNumber: '6205DDU',
            name: 'NSK Deep Groove Bearing',
            manufacturer: 'NSK',
            category: 'Bearings',
            domain: 'industrial',
            interchangeType: 'direct_drop_in',
            fffScore: { fit: 'exact', form: 'exact', function: 'identical', overallScore: 98 },
            keyDifferences: ['Direct 1:1 drop-in replacement'],
            specs: [{ label: 'Bore', value: '25 mm' }],
            availability: 'in_stock',
          },
        ],
      },
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }))),
    )

    const result = await lookupEquivalents({ partNumber: '6205-2RS' })
    expect(result.equivalents.length).toBe(1)
    expect(result.equivalents[0].interchangeType).toBe('direct_drop_in')
    expect(result.equivalents[0].fffScore.overallScore).toBe(98)

    const byIdResult = await getEquivalentsForPart('part-1')
    expect(byIdResult.equivalents.length).toBe(1)
  })
})

describe('3. PDF Datasheet Service (Frontend)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('posts PDF payload and parses technical spec matrix', async () => {
    const mockResponse = {
      data: {
        fileName: 'rexroth-4we6.pdf',
        pageCount: 4,
        detectedManufacturer: 'Bosch Rexroth',
        detectedModelCode: '4WE6',
        detectedCategory: 'Valves',
        specs: [
          { label: 'Operating Pressure', value: '350 bar', confidence: 0.95 },
          { label: 'Max Flow Rate', value: '80 L/min', confidence: 0.95 },
        ],
        rawTextPreview: 'BOSCH REXROTH 4WE6',
        suggestedSearchQuery: 'Bosch Rexroth 4WE6',
      },
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }))),
    )

    const result = await parsePdfDatasheet('bW9ja3BkZg==', 'rexroth-4we6.pdf')
    expect(result.detectedManufacturer).toBe('Bosch Rexroth')
    expect(result.detectedModelCode).toBe('4WE6')
    expect(result.specs.length).toBe(2)
  })
})
