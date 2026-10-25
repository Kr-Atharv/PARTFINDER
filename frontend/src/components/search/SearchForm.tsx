import { Camera, FileText, RotateCcw, Search, SlidersHorizontal } from 'lucide-react'
import { useId } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { SearchBox } from '@/components/search/SearchBox'
import { domains } from '@/data/domains'
import { cn } from '@/lib/cn'
import { MAX_FIELD_LENGTH, MAX_QUERY_LENGTH } from '@/lib/validation'
import type { SearchCriteria, SearchErrors } from '@/types'

interface SearchFormProps {
  value: SearchCriteria
  errors: SearchErrors
  loading: boolean
  onChange: (next: SearchCriteria) => void
  /** Called with the criteria to run when a suggestion was picked (the form state may not have updated yet). */
  onSubmit: (override?: SearchCriteria) => void
  onReset: () => void
  /** Scroll to or open the specification filter panel */
  onOpenSpecs?: () => void
  /** Open camera or photo scanner modal */
  onOpenScanner?: () => void
  /** Open PDF datasheet parser modal */
  onOpenDatasheet?: () => void
  /** Real manufacturer names from the catalogue, offered as completions. Omitted when unavailable. */
  manufacturerOptions?: string[]
}

export function SearchForm({
  value,
  errors,
  loading,
  onChange,
  onSubmit,
  onReset,
  onOpenSpecs,
  onOpenScanner,
  onOpenDatasheet,
  manufacturerOptions,
}: SearchFormProps) {
  const listId = useId()
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault() // Enter in any field submits the form.
    onSubmit()
  }

  const handlePick = (query: string) => {
    const next = { ...value, query }
    onChange(next)
    onSubmit(next)
  }

  const toggleDomain = (id: SearchCriteria['domain']) => {
    onChange({ ...value, domain: value.domain === id ? null : id })
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} noValidate aria-label="Part search">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink-800">Domain</legend>
          <div className="flex flex-wrap gap-2">
            {domains.map(({ id, label, icon: Icon }) => {
              const selected = value.domain === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleDomain(id)}
                  aria-pressed={selected}
                  className={cn(
                    'inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors',
                    selected
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-line-strong bg-surface text-ink-600 hover:bg-surface-muted',
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-xs text-ink-500">
            Select a domain to narrow the search. With none selected, all domains are searched.
          </p>
        </fieldset>

        <div className="mt-5">
          <SearchBox
            label="Part number, component name or description"
            placeholder="e.g. hydraulic seal kit, voltage regulator, brake pad"
            value={value.query}
            onChange={(query) => onChange({ ...value, query })}
            onSelect={handlePick}
            error={errors.query}
            maxLength={MAX_QUERY_LENGTH + 20}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input
            label="Manufacturer (optional)"
            placeholder="e.g. Northfield"
            value={value.manufacturer}
            onChange={(event) => onChange({ ...value, manufacturer: event.target.value })}
            error={errors.manufacturer}
            maxLength={MAX_FIELD_LENGTH + 20}
            autoComplete="off"
            list={manufacturerOptions && manufacturerOptions.length > 0 ? listId : undefined}
          />
          {manufacturerOptions && manufacturerOptions.length > 0 && (
            <datalist id={listId}>
              {manufacturerOptions.slice(0, 200).map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          )}
          <Input
            label="Model or application (optional)"
            placeholder="e.g. press, sedan, motor"
            value={value.model}
            onChange={(event) => onChange({ ...value, model: event.target.value })}
            error={errors.model}
            hint="Matches typical applications listed on a part."
            maxLength={MAX_FIELD_LENGTH + 20}
            autoComplete="off"
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            loading={loading}
            icon={<Search className="h-4 w-4" aria-hidden="true" />}
          >
            {loading ? 'Searching…' : 'Search'}
          </Button>
          <Button
            variant="secondary"
            onClick={onReset}
            icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
          >
            Reset
          </Button>
          {onOpenSpecs && (
            <Button
              type="button"
              variant="secondary"
              onClick={onOpenSpecs}
              icon={<SlidersHorizontal className="h-4 w-4" aria-hidden="true" />}
            >
              Filter by Specifications
            </Button>
          )}
          {onOpenScanner && (
            <Button
              type="button"
              variant="secondary"
              onClick={onOpenScanner}
              icon={<Camera className="h-4 w-4" aria-hidden="true" />}
            >
              Scan Nameplate / Camera
            </Button>
          )}
          {onOpenDatasheet && (
            <Button
              type="button"
              variant="secondary"
              onClick={onOpenDatasheet}
              icon={<FileText className="h-4 w-4" aria-hidden="true" />}
            >
              Upload PDF Datasheet
            </Button>
          )}
        </div>
      </form>
    </Card>
  )
}
