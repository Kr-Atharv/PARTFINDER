import type { Part } from '@/types'

/** Minimal valid Part for tests. Clearly synthetic: never shown to users. */
export function makePart(overrides: Partial<Part> = {}): Part {
  return {
    id: 'p1',
    name: 'Test Seal Kit',
    partNumber: 'T-001',
    manufacturer: 'Testco',
    domain: 'industrial',
    category: 'Seals',
    description: 'test part',
    specs: [],
    availability: 'in_stock',
    source: { name: 'Test source', url: 'https://example.test/p1' },
    usedIn: [],
    keywords: [],
    isDemo: false,
    ...overrides,
  }
}
