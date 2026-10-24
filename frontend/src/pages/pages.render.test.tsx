import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { CompareProvider } from '@/context/CompareContext'
import { PartDrawerProvider } from '@/context/PartDrawerContext'
import { ToastProvider } from '@/context/ToastContext'
import { userData } from '@/state/userData'
import { makePart } from '@/test/fixtures'
import ComparePartsPage from '@/pages/ComparePartsPage'
import OverviewPage from '@/pages/OverviewPage'
import SavedPartsPage from '@/pages/SavedPartsPage'
import SearchHistoryPage from '@/pages/SearchHistoryPage'

/**
 * Render-time smoke test: renders each page to static HTML (no effects run, no browser) to catch
 * crashes and to check key labels. It does not test interaction, layout or colours.
 */
const stripComments = (html: string) => html.replace(/<!-- -->/g, '')

const a = makePart({ id: 'a', name: 'Alpha Seal', partNumber: 'A-1', specs: [{ label: 'Bore diameter', value: '80 mm' }], isDemo: true })
const b = makePart({
  id: 'b',
  name: 'Beta Seal',
  partNumber: 'B-1',
  specs: [{ label: 'Bore diameter', value: '100 mm' }],
  origin: 'research',
  price: { raw: '12.50', amount: 12.5, currencyKey: 'USD' } as never,
})

// React's server renderer separates adjacent text nodes with <!-- -->; remove them so text reads naturally.
const wrap = (node: React.ReactNode) =>
  stripComments(renderToString(
    <MemoryRouter>
      <ToastProvider>
        <CompareProvider>
          <PartDrawerProvider>{node}</PartDrawerProvider>
        </CompareProvider>
      </ToastProvider>
    </MemoryRouter>,
  ))

describe('pages render', () => {
  // Server rendering warns that layout effects do not run; that is expected for this test and
  // irrelevant for the browser-only app. Every other console error still fails the run below.
  const realError = console.error
  const unexpected: string[] = []
  beforeAll(() => {
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const text = String(args[0])
      if (text.includes('useLayoutEffect does nothing on the server')) return
      unexpected.push(text)
      realError(...args)
    })
  })

  describe('with no data', () => {
    it('Dashboard shows honest empty states and no sample data', () => {
      const html = wrap(<OverviewPage />)
      expect(html).toContain('No searches yet')
      expect(html).toContain('No saved parts yet')
      expect(html).toContain('No comparisons yet')
      expect(html).toContain('Stored only in this browser')
      expect(html).not.toMatch(/Sample data|foundation only/i)
    })
    it('Saved Parts and History show empty states', () => {
      expect(wrap(<SavedPartsPage />)).toContain('No saved parts yet')
      expect(wrap(<SearchHistoryPage />)).toContain('No search history yet')
    })
    it('Compare shows the empty state', () => {
      expect(wrap(<ComparePartsPage />)).toContain('No parts selected for comparison')
    })
  })

  describe('with data', () => {
    beforeAll(() => {
      userData.recordSearch({ kind: 'catalogue', query: 'seal kit', domain: 'industrial', manufacturer: '', model: '', resultCount: 4 })
      userData.recordSearch({ kind: 'research', query: 'brake pad', domain: 'automotive', manufacturer: '', model: '' })
      userData.toggleSaved(a)
      userData.recordComparison([a, b])
    })

    it('Dashboard lists them, with a Reopen action', () => {
      const html = wrap(<OverviewPage />)
      expect(html).toContain('seal kit')
      expect(html).toContain('Live research')
      expect(html).toContain('Alpha Seal')
      expect(html).toContain('Alpha Seal vs Beta Seal')
      expect(html).toContain('Reopen')
      expect(html).toContain('4 results')
    })
    it('History page renders searches with remove and open controls', () => {
      const html = wrap(<SearchHistoryPage />)
      expect(html).toContain('Searches (2)')
      expect(html).toContain('Comparisons (1)')
      expect(html).toContain('Open search: seal kit')
      expect(html).toContain('Clear search history')
    })
    it('Saved Parts renders the saved part card', () => {
      const html = wrap(<SavedPartsPage />)
      expect(html).toContain('Alpha Seal')
      expect(html).toContain('1 saved part')
    })
  })

  describe('Compare with two parts selected', () => {
    beforeAll(() => {
      localStorage.setItem('partfinder_compare_items', JSON.stringify([a, b]))
    })
    it('renders table, demo notice, price row, highlights and key differences; no false "no backend" claim', () => {
      const html = wrap(<ComparePartsPage />)
      expect(html).toContain('Includes illustrative demo data')
      expect(html).toContain('Alpha Seal')
      expect(html).toContain('Listed price')
      expect(html).toContain('12.50 USD')
      expect(html).toContain('Not listed')
      expect(html).toContain('Highest')
      expect(html).toContain('Lowest')
      expect(html).toContain('Key differences')
      expect(html).toContain('A PASS is not a guarantee')
      expect(html).not.toMatch(/no live source, backend or API is connected/i)
    })
  })

  // Keep this last: it inspects what the tests above logged.
  it('logs no unexpected React errors or warnings while rendering', () => {
    expect(unexpected).toEqual([])
  })
})
