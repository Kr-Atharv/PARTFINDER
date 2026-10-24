import { isDomainId } from '@/data/domains'
import type { SearchCriteria, SearchErrors } from '@/types'

export const MAX_QUERY_LENGTH = 100
export const MAX_FIELD_LENGTH = 60

export const emptyCriteria: SearchCriteria = { query: '', domain: null, manufacturer: '', model: '' }

export function validateCriteria(criteria: SearchCriteria): SearchErrors {
  const errors: SearchErrors = {}
  const query = criteria.query.trim()

  if (!query) {
    errors.query = 'Enter a part number, component name or description to search.'
  } else if (query.length < 2) {
    errors.query = 'Enter at least 2 characters.'
  } else if (!/[a-z0-9]/i.test(query)) {
    errors.query = 'Use letters or numbers in your search.'
  } else if (query.length > MAX_QUERY_LENGTH) {
    errors.query = `Keep the search under ${MAX_QUERY_LENGTH} characters.`
  }

  if (criteria.manufacturer.trim().length > MAX_FIELD_LENGTH) {
    errors.manufacturer = `Keep the manufacturer under ${MAX_FIELD_LENGTH} characters.`
  }
  if (criteria.model.trim().length > MAX_FIELD_LENGTH) {
    errors.model = `Keep the model under ${MAX_FIELD_LENGTH} characters.`
  }
  return errors
}

export function hasErrors(errors: SearchErrors): boolean {
  return Object.keys(errors).length > 0
}

/** Reads the form values from the URL (no validation). */
export function paramsToDraft(params: URLSearchParams): SearchCriteria {
  const domain = params.get('domain')
  return {
    query: params.get('q') ?? '',
    domain: isDomainId(domain) ? domain : null,
    manufacturer: params.get('mfr') ?? '',
    model: params.get('model') ?? '',
  }
}

/** Returns criteria only when the URL describes a valid, runnable search. */
export function paramsToCriteria(params: URLSearchParams): SearchCriteria | null {
  const draft = paramsToDraft(params)
  if (hasErrors(validateCriteria(draft))) return null
  return normalizeCriteria(draft)
}

export function normalizeCriteria(criteria: SearchCriteria): SearchCriteria {
  return {
    query: criteria.query.trim(),
    domain: criteria.domain,
    manufacturer: criteria.manufacturer.trim(),
    model: criteria.model.trim(),
  }
}

export function criteriaToParams(criteria: SearchCriteria): URLSearchParams {
  const normalized = normalizeCriteria(criteria)
  const params = new URLSearchParams()
  params.set('q', normalized.query)
  if (normalized.domain) params.set('domain', normalized.domain)
  if (normalized.manufacturer) params.set('mfr', normalized.manufacturer)
  if (normalized.model) params.set('model', normalized.model)
  return params
}
