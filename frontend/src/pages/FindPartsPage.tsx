import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ResultsPanel } from '@/components/search/ResultsPanel'
import { SearchForm } from '@/components/search/SearchForm'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { PageHeading } from '@/components/ui/PageHeading'
import { domainById } from '@/data/domains'
import {
  criteriaToParams,
  emptyCriteria,
  hasErrors,
  normalizeCriteria,
  paramsToCriteria,
  paramsToDraft,
  validateCriteria,
} from '@/lib/validation'
import { searchParts } from '@/services/partSearch'
import type { DomainId, Part, SearchCriteria, SearchErrors } from '@/types'

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; results: Part[] }
  | { status: 'error'; message: string }

const EXAMPLE_SEARCHES: Array<SearchCriteria & { domain: DomainId }> = [
  { query: 'hydraulic seal kit', domain: 'industrial', manufacturer: '', model: '' },
  { query: 'voltage regulator', domain: 'electronics', manufacturer: '', model: '' },
  { query: 'brake pad', domain: 'automotive', manufacturer: '', model: '' },
]

export default function FindPartsPage() {
  const [params, setParams] = useSearchParams()
  const paramKey = params.toString()

  // The URL is the source of truth for the submitted search, so results survive
  // navigation, the back button and links from other pages.
  const urlDraft = useMemo(() => paramsToDraft(new URLSearchParams(paramKey)), [paramKey])
  const criteria = useMemo(() => paramsToCriteria(new URLSearchParams(paramKey)), [paramKey])

  const [draft, setDraft] = useState<SearchCriteria>(urlDraft)
  const [errors, setErrors] = useState<SearchErrors>({})
  const [runId, setRunId] = useState(0)
  const [state, setState] = useState<SearchState>({ status: 'idle' })

  // Keep the form in step with the URL (back/forward, links from other pages).
  useEffect(() => {
    setDraft(urlDraft)
    setErrors({})
  }, [urlDraft])

  useEffect(() => {
    if (!criteria) {
      setState({ status: 'idle' })
      return
    }
    let cancelled = false
    setState({ status: 'loading' })
    searchParts(criteria)
      .then((results) => {
        if (!cancelled) setState({ status: 'success', results })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const message = error instanceof Error ? error.message : 'The search could not be completed.'
        setState({ status: 'error', message })
      })
    return () => {
      cancelled = true
    }
  }, [criteria, runId])

  const runSearch = (next: SearchCriteria) => {
    const found = validateCriteria(next)
    setErrors(found)
    if (hasErrors(found)) return
    setParams(criteriaToParams(next))
    setRunId((n) => n + 1) // Re-run even when the submitted search is unchanged.
  }

  // Editing a field clears that field's validation message.
  const handleDraftChange = (next: SearchCriteria) => {
    setDraft(next)
    setErrors((prev) => ({
      query: next.query !== draft.query ? undefined : prev.query,
      manufacturer: next.manufacturer !== draft.manufacturer ? undefined : prev.manufacturer,
      model: next.model !== draft.model ? undefined : prev.model,
    }))
  }

  const handleReset = () => {
    setDraft(emptyCriteria)
    setErrors({})
    setParams({})
  }

  const loading = state.status === 'loading'

  return (
    <div className="space-y-6">
      <PageHeading
        title="Find Parts"
        description="Search by part number, component name or description across industrial, electronics and automotive parts."
        actions={<Badge tone="warning">Demo data</Badge>}
      />

      <Alert tone="info" title="Searching a demo catalogue">
        Results come from a small built-in sample catalogue. Manufacturers, part numbers,
        specifications and sources are invented for demonstration and are not verified. Live-web
        search is not connected yet.
      </Alert>

      <SearchForm
        value={draft}
        errors={errors}
        loading={loading}
        onChange={handleDraftChange}
        onSubmit={() => runSearch(draft)}
        onReset={handleReset}
      />

      {state.status === 'idle' && (
        <EmptyState
          icon={Search}
          title="Search for a part"
          description="Enter a part number, component name or description above. You can narrow by domain, manufacturer or model. Or try one of these examples."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLE_SEARCHES.map((example) => {
                const DomainIcon = domainById[example.domain].icon
                return (
                  <Button
                    key={example.query}
                    variant="secondary"
                    size="sm"
                    icon={<DomainIcon className="h-4 w-4" aria-hidden="true" />}
                    onClick={() => {
                      const next = normalizeCriteria(example)
                      setDraft(next)
                      runSearch(next)
                    }}
                  >
                    {example.query}
                  </Button>
                )
              })}
            </div>
          }
        />
      )}

      {state.status === 'loading' && (
        <Card>
          <LoadingState label="Searching…" />
        </Card>
      )}

      {state.status === 'error' && (
        <Alert
          tone="error"
          title="The search could not be completed"
          action={
            <Button variant="secondary" size="sm" onClick={() => setRunId((n) => n + 1)}>
              Try again
            </Button>
          }
        >
          {state.message}
        </Alert>
      )}

      {state.status === 'success' && criteria && (
        <ResultsPanel key={`${paramKey}:${runId}`} results={state.results} criteria={criteria} />
      )}
    </div>
  )
}
