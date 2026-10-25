import { isDomainId } from '@/data/domains'
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, emptyRefinements, hasRefinements } from '@/lib/search'
import type { Availability, NumericRangeSpec, SearchCriteria, SearchErrors, SearchPaging, SearchRefinements, SortKey } from '@/types'

export const MAX_QUERY_LENGTH = 100
export const MAX_FIELD_LENGTH = 60

export const emptyCriteria: SearchCriteria = { query: '', domain: null, manufacturer: '', model: '' }

/**
 * `allowEmptyQuery` lets people browse by domain, manufacturer, category or
 * specification without typing a query. A query that is present is still validated.
 */
export function validateCriteria(criteria: SearchCriteria, allowEmptyQuery = false): SearchErrors {
  const errors: SearchErrors = {}
  const query = criteria.query.trim()

  if (!query && allowEmptyQuery) {
    // Browsing: nothing to validate for the query.
  } else if (!query) {
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

const AVAILABILITY_VALUES: Availability[] = ['in_stock', 'limited', 'out_of_stock', 'unknown']
const SORT_VALUES: SortKey[] = ['name-asc', 'name-desc', 'manufacturer-asc', 'manufacturer-desc']

export function paramsToRefinements(params: URLSearchParams): SearchRefinements {
  const availability = params.get('avail') as Availability | null
  const base: SearchRefinements = {
    category: (params.get('cat') ?? '').slice(0, MAX_FIELD_LENGTH),
    availability: availability && AVAILABILITY_VALUES.includes(availability) ? availability : '',
    specLabel: (params.get('spec') ?? '').slice(0, MAX_FIELD_LENGTH),
    specValue: (params.get('specv') ?? '').slice(0, MAX_FIELD_LENGTH),
  }

  const getRange = (prefix: string) => {
    const rawMin = params.get(`${prefix}Min`) ?? undefined
    const rawMax = params.get(`${prefix}Max`) ?? undefined
    const unit = params.get(`${prefix}Unit`) ?? undefined
    if (rawMin !== undefined || rawMax !== undefined || unit !== undefined) {
      const min = rawMin !== undefined && rawMin.trim() !== '' && !Number.isNaN(Number(rawMin)) ? Number(rawMin) : rawMin
      const max = rawMax !== undefined && rawMax.trim() !== '' && !Number.isNaN(Number(rawMax)) ? Number(rawMax) : rawMax
      return { min, max, unit }
    }
    return undefined
  }

  const detailedMfr = params.get('specMfr') ?? undefined
  const detailedPn = params.get('specPn') ?? undefined
  const detailedMat = params.get('specMat') ?? undefined
  const detailedThread = params.get('specThread') ?? undefined
  const detailedPort = params.get('specPort') ?? undefined
  const detailedTol = params.get('specTol') ?? undefined
  const detailedModel = params.get('specModel') ?? undefined
  const detailedLoc = params.get('specLoc') ?? undefined

  const diameter = getRange('dia')
  const length = getRange('len')
  const width = getRange('wid')
  const height = getRange('hgt')
  const weight = getRange('wt')
  const pressure = getRange('press')
  const temperature = getRange('temp')
  const voltage = getRange('volt')
  const current = getRange('curr')
  const power = getRange('pwr')
  const flowRate = getRange('flow')
  const speed = getRange('rpm')
  const price = getRange('price')

  const hasAnyDetailed = Boolean(
    detailedMfr || detailedPn || detailedMat || detailedThread || detailedPort ||
    detailedTol || detailedModel || detailedLoc ||
    diameter || length || width || height || weight ||
    pressure || temperature || voltage || current || power ||
    flowRate || speed || price,
  )

  if (hasAnyDetailed) {
    base.specs = {
      manufacturer: detailedMfr,
      partNumber: detailedPn,
      material: detailedMat,
      threadSize: detailedThread,
      portSize: detailedPort,
      tolerance: detailedTol,
      compatibleModel: detailedModel,
      location: detailedLoc,
      diameter,
      length,
      width,
      height,
      weight,
      pressure,
      temperature,
      voltage,
      current,
      power,
      flowRate,
      speed,
      price,
    }
  }

  return base
}

export function paramsToPaging(params: URLSearchParams): SearchPaging {
  const page = Math.floor(Number(params.get('page')))
  const size = Number(params.get('size'))
  const sort = params.get('sort') as SortKey | null
  return {
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    pageSize: (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE,
    sort: sort && SORT_VALUES.includes(sort) ? sort : 'name-asc',
  }
}

/** True when the URL asks for something to be listed even without a query. */
export function hasBrowseIntent(params: URLSearchParams): boolean {
  const draft = paramsToDraft(params)
  const r = paramsToRefinements(params)
  return Boolean(
    params.get('browse') ||
      draft.domain ||
      draft.manufacturer.trim() ||
      draft.model.trim() ||
      hasRefinements(r),
  )
}

/** Returns criteria only when the URL describes a valid, runnable search. */
export function paramsToCriteria(params: URLSearchParams): SearchCriteria | null {
  const draft = paramsToDraft(params)
  if (hasErrors(validateCriteria(draft, hasBrowseIntent(params)))) return null
  return normalizeCriteria(draft)
}

/**
 * Builds the URL for a search. Paging resets to page 1 unless a page is given, and
 * defaults are omitted so shared links stay short.
 */
export function buildSearchParams(
  criteria: SearchCriteria,
  refinements: SearchRefinements = emptyRefinements,
  paging: Partial<SearchPaging> = {},
  extra: { browse?: boolean; tab?: string } = {},
): URLSearchParams {
  const params = criteriaToParams(criteria)
  if (!criteria.query.trim()) params.delete('q')
  if (refinements.category) params.set('cat', refinements.category)
  if (refinements.availability) params.set('avail', refinements.availability)
  if (refinements.specLabel) params.set('spec', refinements.specLabel)
  if (refinements.specValue) params.set('specv', refinements.specValue)

  // Serialize detailed specs if present
  if (refinements.specs) {
    const s = refinements.specs
    if (s.manufacturer) params.set('specMfr', s.manufacturer)
    if (s.partNumber) params.set('specPn', s.partNumber)
    if (s.material) params.set('specMat', s.material)
    if (s.threadSize) params.set('specThread', s.threadSize)
    if (s.portSize) params.set('specPort', s.portSize)
    if (s.tolerance) params.set('specTol', s.tolerance)
    if (s.compatibleModel) params.set('specModel', s.compatibleModel)
    if (s.location) params.set('specLoc', s.location)

    const setRange = (prefix: string, range?: NumericRangeSpec) => {
      if (!range) return
      if (range.min !== undefined && range.min !== '') params.set(`${prefix}Min`, String(range.min))
      if (range.max !== undefined && range.max !== '') params.set(`${prefix}Max`, String(range.max))
      if (range.unit) params.set(`${prefix}Unit`, range.unit)
    }

    setRange('dia', s.diameter)
    setRange('len', s.length)
    setRange('wid', s.width)
    setRange('hgt', s.height)
    setRange('wt', s.weight)
    setRange('press', s.pressure)
    setRange('temp', s.temperature)
    setRange('volt', s.voltage)
    setRange('curr', s.current)
    setRange('pwr', s.power)
    setRange('flow', s.flowRate)
    setRange('rpm', s.speed)
    setRange('price', s.price)
  }

  if (paging.sort && paging.sort !== 'name-asc') params.set('sort', paging.sort)
  if (paging.pageSize && paging.pageSize !== DEFAULT_PAGE_SIZE) params.set('size', String(paging.pageSize))
  if (paging.page && paging.page > 1) params.set('page', String(paging.page))
  if (extra.browse) params.set('browse', '1')
  if (extra.tab) params.set('tab', extra.tab)
  return params
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
