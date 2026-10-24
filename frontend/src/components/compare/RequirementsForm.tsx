import { ClipboardCheck, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { domainById } from '@/data/domains'
import { fieldsForDomain } from '@/data/requirementFields'
import { MAX_TARGET_LENGTH } from '@/lib/compatibility'
import type { DomainId } from '@/types'
import type { FieldErrors, RequirementInput } from '@/types/compatibility'

interface RequirementsFormProps {
  domains: DomainId[]
  value: RequirementInput
  errors: FieldErrors
  dirty: boolean
  loading: boolean
  onTargetChange: (target: string) => void
  onValueChange: (fieldId: string, value: string) => void
  onSubmit: () => void
  onReset: () => void
}

/** Target machine, board or vehicle and the constraints to check each part against. */
export function RequirementsForm({
  domains,
  value,
  errors,
  dirty,
  loading,
  onTargetChange,
  onValueChange,
  onSubmit,
  onReset,
}: RequirementsFormProps) {
  return (
    <Card>
      <CardHeader
        title="Target requirements"
        description="Describe the machine, board or vehicle. Every value you enter is a mandatory requirement; leave a field blank to skip it."
      />
      <form
        className="mt-5 space-y-6"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <Input
          label="Target machine, board or vehicle (optional)"
          hint="Used as a label on the results. It is not matched against part data."
          placeholder="e.g. Press line 3, cylinder B"
          maxLength={MAX_TARGET_LENGTH + 20}
          value={value.target}
          error={errors.target}
          onChange={(event) => onTargetChange(event.target.value)}
        />

        {domains.map((domain) => {
          const fields = fieldsForDomain(domain)
          return (
            <fieldset key={domain} className="min-w-0">
              <legend className="mb-3 text-sm font-semibold text-ink-900">
                {domainById[domain].label} requirements
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                {fields.map((field) => {
                  const label = field.unit ? `${field.label} (${field.unit})` : field.label
                  if (field.input === 'select') {
                    return (
                      <div key={field.id}>
                        <Select
                          label={label}
                          value={value.values[field.id] ?? ''}
                          options={[
                            { value: '', label: 'Not specified' },
                            ...(field.options ?? []).map((option) => ({ value: option, label: option })),
                          ]}
                          onChange={(event) => onValueChange(field.id, event.target.value)}
                          aria-describedby={`${field.id}-hint`}
                        />
                        <p id={`${field.id}-hint`} className="mt-1.5 text-xs text-ink-500">
                          {field.hint}
                        </p>
                        {errors[field.id] && (
                          <p className="mt-1 text-xs font-medium text-red-700">{errors[field.id]}</p>
                        )}
                      </div>
                    )
                  }
                  return (
                    <Input
                      key={field.id}
                      label={label}
                      hint={field.hint}
                      placeholder={field.placeholder}
                      inputMode={field.input === 'number' ? 'decimal' : undefined}
                      autoComplete="off"
                      value={value.values[field.id] ?? ''}
                      error={errors[field.id]}
                      onChange={(event) => onValueChange(field.id, event.target.value)}
                    />
                  )
                })}
              </div>
            </fieldset>
          )
        })}

        {errors.form && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {errors.form}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Button
            type="submit"
            loading={loading}
            icon={<ClipboardCheck className="h-4 w-4" aria-hidden="true" />}
          >
            Assess compatibility
          </Button>
          <Button
            variant="secondary"
            icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
            onClick={onReset}
          >
            Reset requirements
          </Button>
          {dirty && (
            <p className="text-sm text-amber-800" aria-live="polite">
              Changes not applied yet. Choose Assess compatibility to update the results.
            </p>
          )}
        </div>
      </form>
    </Card>
  )
}
