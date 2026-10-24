import { RotateCcw, Search } from 'lucide-react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { domains } from '@/data/domains'
import { cn } from '@/lib/cn'
import { MAX_FIELD_LENGTH, MAX_QUERY_LENGTH } from '@/lib/validation'
import type { SearchCriteria, SearchErrors } from '@/types'

interface SearchFormProps {
  value: SearchCriteria
  errors: SearchErrors
  loading: boolean
  onChange: (next: SearchCriteria) => void
  onSubmit: () => void
  onReset: () => void
}

export function SearchForm({ value, errors, loading, onChange, onSubmit, onReset }: SearchFormProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault() // Enter in any field submits the form.
    onSubmit()
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
                      : 'border-line-strong bg-white text-ink-600 hover:bg-surface-muted',
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

        <Input
          className="mt-5"
          label="Part number, component name or description"
          placeholder="e.g. hydraulic seal kit, voltage regulator, brake pad"
          icon={<Search className="h-4 w-4" aria-hidden="true" />}
          value={value.query}
          onChange={(event) => onChange({ ...value, query: event.target.value })}
          error={errors.query}
          maxLength={MAX_QUERY_LENGTH + 20}
          autoComplete="off"
          enterKeyHint="search"
        />

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input
            label="Manufacturer (optional)"
            placeholder="e.g. Northfield"
            value={value.manufacturer}
            onChange={(event) => onChange({ ...value, manufacturer: event.target.value })}
            error={errors.manufacturer}
            maxLength={MAX_FIELD_LENGTH + 20}
            autoComplete="off"
          />
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
        </div>
      </form>
    </Card>
  )
}
