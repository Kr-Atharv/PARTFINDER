import { describe, expect, it } from 'vitest'
import { NdjsonParser, researchedToPart } from '@/services/researchService'
import type { ResearchedPart } from '@/services/researchService'

describe('NdjsonParser', () => {
  const started = { type: 'started', query: 'seal', searchQuery: 'seal kit', maxResults: 5 }
  const done = { type: 'persisted', count: 2 }

  it('parses complete lines', () => {
    const parser = new NdjsonParser()
    const events = parser.push(`${JSON.stringify(started)}\n${JSON.stringify(done)}\n`)
    expect(events.map((e) => e.type)).toEqual(['started', 'persisted'])
  })

  it('handles a chunk that splits a line in the middle', () => {
    const parser = new NdjsonParser()
    const line = JSON.stringify(started)
    expect(parser.push(line.slice(0, 15))).toEqual([])
    const events = parser.push(`${line.slice(15)}\n${JSON.stringify(done).slice(0, 6)}`)
    expect(events).toEqual([started])
    expect(parser.push(`${JSON.stringify(done).slice(6)}\n`)).toEqual([done])
  })

  it('handles a split inside a multi-byte-safe string and CRLF endings', () => {
    const parser = new NdjsonParser()
    const event = { type: 'persisted', count: 1, note: 'Ø 80 mm – ok' }
    const text = `${JSON.stringify(event)}\r\n`
    expect(parser.push(text.slice(0, 30))).toEqual([])
    expect(parser.push(text.slice(30))).toEqual([event])
  })

  it('flush parses a final line with no trailing newline', () => {
    const parser = new NdjsonParser()
    expect(parser.push(JSON.stringify(done))).toEqual([])
    expect(parser.flush()).toEqual([done])
    expect(parser.flush()).toEqual([])
  })

  it('skips and counts invalid or untyped lines', () => {
    const parser = new NdjsonParser()
    const events = parser.push(`not json\n{"no":"type"}\n${JSON.stringify(done)}\n\n`)
    expect(events).toEqual([done])
    expect(parser.skipped).toBe(2)
  })
})

describe('researchedToPart', () => {
  const raw: ResearchedPart = {
    id: 'r1',
    name: 'Seal',
    partNumber: 'S-1',
    manufacturer: 'Acme',
    domain: 'industrial',
    category: 'Seals',
    description: 'd',
    availability: 'in_stock',
    specs: [{ label: 'Max pressure', value: '250 bar' }],
    source: { name: 'Acme site', url: 'https://acme.test/s1', retrievedAt: '2026-01-01T00:00:00Z' },
    sourceClaims: [{ label: 'Max pressure', claimedValue: '250 bar', evidence: 'Max pressure 250 bar' }],
    price: { raw: '12.50', amount: 12.5, currencyKey: 'USD' } as ResearchedPart['price'],
    evidenceLevel: 'snippet_only',
  }

  it('maps without inventing anything and marks the part as research, not demo', () => {
    const part = researchedToPart(raw)
    expect(part.origin).toBe('research')
    expect(part.isDemo).toBe(false)
    expect(part.price).toEqual(raw.price)
    expect(part.evidenceLevel).toBe('snippet_only')
    expect(part.claims?.[0]).toMatchObject({ label: 'Max pressure', value: '250 bar', sourceUrl: 'https://acme.test/s1' })
    expect(part.usedIn).toEqual([])
  })

  it('leaves price undefined when the page listed none', () => {
    expect(researchedToPart({ ...raw, price: undefined }).price).toBeUndefined()
  })
})
