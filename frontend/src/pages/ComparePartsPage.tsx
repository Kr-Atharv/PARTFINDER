import { ArrowLeft, ClipboardList, GitCompareArrows, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AssessmentSummary, SAFETY_WARNING } from '@/components/compare/AssessmentSummary'
import { EvidencePanel } from '@/components/compare/EvidencePanel'
import { RequirementsForm } from '@/components/compare/RequirementsForm'
import { SpecAssessmentTable } from '@/components/compare/SpecAssessmentTable'
import { SpecComparisonTable } from '@/components/compare/SpecComparisonTable'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { PageHeading } from '@/components/ui/PageHeading'
import { useCompare } from '@/context/CompareContext'
import { configuredFields, validateRequirements } from '@/lib/compatibility'
import { buildSpecMatrix } from '@/lib/specMatrix'
import { assessCompatibility } from '@/services/compatibilityService'
import { requirementsActions, useRequirements } from '@/state/requirementsStore'
import type { AssessmentReport, FieldErrors } from '@/types/compatibility'

type AssessmentState =
  | { phase: 'idle' }
  | { phase: 'loading'; report?: AssessmentReport }
  | { phase: 'ready'; report: AssessmentReport }
  | { phase: 'error'; message: string }

export default function ComparePartsPage() {
  const { items, count, max, remove, clear } = useCompare()
  const { draft, applied } = useRequirements()
  const [onlyDifferences, setOnlyDifferences] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [assessment, setAssessment] = useState<AssessmentState>({ phase: 'idle' })
  const [runId, setRunId] = useState(0)
  const resultsHeading = useRef<HTMLHeadingElement>(null)
  const focusResults = useRef(false)

  const matrix = useMemo(() => buildSpecMatrix(items), [items])
  const domains = useMemo(() => Array.from(new Set(items.map((part) => part.domain))), [items])
  const visibleRows = onlyDifferences ? matrix.rows.filter((row) => row.status !== 'same') : matrix.rows
  const differingCount = matrix.rows.filter((row) => row.status === 'differs').length
  const gapCount = matrix.rows.filter((row) => row.status === 'gap').length
  const dirty = JSON.stringify(draft) !== JSON.stringify(applied)

  // Run the assessment whenever the selection or the applied requirements change.
  useEffect(() => {
    if (!applied || items.length === 0) {
      setAssessment({ phase: 'idle' })
      return
    }
    let cancelled = false
    setAssessment((prev) =>
      prev.phase === 'ready' ? { phase: 'loading', report: prev.report } : prev.phase === 'loading' ? prev : { phase: 'loading' },
    )
    assessCompatibility(items, applied)
      .then((report) => {
        if (!cancelled) setAssessment({ phase: 'ready', report })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const message = error instanceof Error ? error.message : 'The assessment could not be completed.'
        setAssessment({ phase: 'error', message })
      })
    return () => {
      cancelled = true
    }
  }, [items, applied, runId])

  // Move focus to the results after the user submits, so the update is announced.
  useEffect(() => {
    if (assessment.phase === 'ready' && focusResults.current) {
      focusResults.current = false
      resultsHeading.current?.focus()
    }
  }, [assessment])

  const handleSubmit = () => {
    const found = validateRequirements(draft, domains)
    if (Object.keys(found).length === 0 && configuredFields(draft, domains).length === 0) {
      found.form = 'Enter at least one requirement to assess.'
    }
    setErrors(found)
    if (Object.keys(found).length > 0) return
    focusResults.current = true
    requirementsActions.apply()
    setRunId((n) => n + 1)
  }

  const clearError = (key: string) =>
    setErrors((prev) => {
      if (!prev[key] && !prev.form) return prev
      const { [key]: _removed, form: _form, ...rest } = prev
      return rest
    })

  const report = assessment.phase === 'ready' || assessment.phase === 'loading' ? assessment.report : undefined

  return (
    <div className="space-y-8">
      <PageHeading
        title="Compare Parts"
        description="Compare candidate parts side by side, then check them against your target requirements with the evidence behind each result."
        actions={
          <>
            <Button to="/find" variant="secondary" icon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}>
              Back to search
            </Button>
            {count > 0 && (
              <Button variant="secondary" icon={<Trash2 className="h-4 w-4" aria-hidden="true" />} onClick={clear}>
                Clear selection
              </Button>
            )}
          </>
        }
      />

      {count === 0 ? (
        <EmptyState
          icon={GitCompareArrows}
          title="No parts selected for comparison"
          description="Use Add to comparison on a search result or part page. Your selection is kept while you move between pages."
          action={
            <Button to="/find" icon={<Search className="h-4 w-4" aria-hidden="true" />}>
              Go to Find Parts
            </Button>
          }
        />
      ) : (
        <>
          <Alert tone="warning" title="Illustrative demo data, not a verified assessment">
            Every value on this page comes from the built-in demo catalogue. Manufacturers, part numbers,
            specifications and sources are invented and have not been verified against any real product.
            Results come from simple local rules; no live source, backend or API is connected.
          </Alert>

          {count === 1 && (
            <Alert
              tone="info"
              title="Add at least one more part to compare"
              action={
                <Button to="/find" variant="secondary" size="sm">
                  Add parts
                </Button>
              }
            >
              One part is selected. Choose up to {max} parts to see them side by side. You can still check
              this part against your requirements below.
            </Alert>
          )}

          {domains.length > 1 && (
            <Alert tone="info" title="Parts from different domains">
              The selected parts span {domains.length} domains, so few specifications will line up. Each part is
              checked only against the requirements for its own domain.
            </Alert>
          )}

          <section aria-labelledby="spec-comparison-heading" className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 id="spec-comparison-heading" className="text-base font-semibold text-ink-900">
                  Specification comparison
                </h2>
                <p className="text-sm text-ink-500" aria-live="polite">
                  {count} of {max} parts selected · {differingCount} differing {differingCount === 1 ? 'row' : 'rows'} ·{' '}
                  {gapCount} {gapCount === 1 ? 'row' : 'rows'} not listed by every part
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={onlyDifferences}
                  onChange={(event) => setOnlyDifferences(event.target.checked)}
                  className="h-4 w-4 rounded border-line-strong text-brand-600"
                />
                Show only differences and gaps
              </label>
            </div>
            <SpecComparisonTable parts={items} rows={visibleRows} onRemove={remove} />
          </section>

          <section aria-labelledby="requirements-heading" className="space-y-3">
            <h2 id="requirements-heading" className="sr-only">
              Target requirements
            </h2>
            <RequirementsForm
              domains={domains}
              value={draft}
              errors={errors}
              dirty={dirty && applied !== null}
              loading={assessment.phase === 'loading'}
              onTargetChange={(target) => {
                requirementsActions.setTarget(target)
                clearError('target')
              }}
              onValueChange={(fieldId, value) => {
                requirementsActions.setValue(fieldId, value)
                clearError(fieldId)
              }}
              onSubmit={handleSubmit}
              onReset={() => {
                requirementsActions.reset()
                setErrors({})
              }}
            />
          </section>

          <section aria-labelledby="assessment-heading" className="space-y-4" aria-busy={assessment.phase === 'loading'}>
            <h2
              id="assessment-heading"
              ref={resultsHeading}
              tabIndex={-1}
              className="text-base font-semibold text-ink-900 focus:outline-none"
            >
              Compatibility assessment
            </h2>

            <Alert tone="warning" title="Not an installation guarantee">
              {SAFETY_WARNING}
            </Alert>

            {assessment.phase === 'idle' && (
              <EmptyState
                icon={ClipboardList}
                title="No assessment yet"
                description="Enter at least one requirement above and choose Assess compatibility. Missing values are never counted as a match."
              />
            )}

            {assessment.phase === 'loading' && !report && (
              <Card>
                <LoadingState label="Assessing compatibility…" />
              </Card>
            )}

            {assessment.phase === 'error' && (
              <Alert
                tone="error"
                title="The assessment could not be completed"
                action={
                  <Button variant="secondary" size="sm" onClick={() => setRunId((n) => n + 1)}>
                    Try again
                  </Button>
                }
              >
                {assessment.message} Your selection and requirements are unchanged.
              </Alert>
            )}

            {report && (
              <>
                {dirty && (
                  <Alert tone="info">
                    The results below reflect the requirements you last applied, not the edited values in the
                    form.
                  </Alert>
                )}
                <AssessmentSummary parts={items} report={report} />

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-ink-900">Required versus discovered values</h3>
                  <SpecAssessmentTable parts={items} report={report} />
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-ink-900">Evidence</h3>
                  <p className="text-sm text-ink-500">
                    What each result is based on: the specification read from the record, the value found and the
                    source. Where nothing was found, none is invented.
                  </p>
                  <EvidencePanel parts={items} report={report} />
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  )
}
