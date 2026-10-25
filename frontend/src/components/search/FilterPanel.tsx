import {
  ChevronDown,
  ChevronUp,
  Cpu,
  Filter,
  FilterX,
  Gauge,
  Info,
  Layers,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Truck,
  Wrench,
  X,
} from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { availabilityMeta } from '@/components/parts/AvailabilityBadge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { SelectOption } from '@/components/ui/Select'
import { availabilityOrder, PAGE_SIZES } from '@/lib/search'
import type { Loaded } from '@/services/catalogService'
import type {
  DetailedSpecFilters,
  Facets,
  NumericRangeSpec,
  SearchPaging,
  SearchRefinements,
  SortKey,
} from '@/types'

export const SORT_OPTIONS: Array<SelectOption & { value: SortKey }> = [
  { value: 'name-asc', label: 'Part name (A to Z)' },
  { value: 'name-desc', label: 'Part name (Z to A)' },
  { value: 'manufacturer-asc', label: 'Manufacturer (A to Z)' },
  { value: 'manufacturer-desc', label: 'Manufacturer (Z to A)' },
]

export interface ActiveChip {
  key: string
  label: string
  clear: Partial<SearchRefinements>
}

/** One removable chip per active refinement. Exported for tests. */
export function activeChips(refinements: SearchRefinements): ActiveChip[] {
  const chips: ActiveChip[] = []
  if (refinements.category) chips.push({ key: 'category', label: `Category: ${refinements.category}`, clear: { category: '' } })
  if (refinements.availability) {
    chips.push({ key: 'availability', label: `Availability: ${availabilityMeta[refinements.availability].label}`, clear: { availability: '' } })
  }
  if (refinements.specLabel || refinements.specValue) {
    const label = [refinements.specLabel, refinements.specValue].filter(Boolean).join(' = ')
    chips.push({ key: 'spec', label: `Spec: ${label}`, clear: { specLabel: '', specValue: '' } })
  }

  // Detailed Spec Filter Chips
  const s = refinements.specs
  if (s) {
    if (s.manufacturer) {
      chips.push({ key: 'specMfr', label: `Mfr: ${s.manufacturer}`, clear: { specs: { ...s, manufacturer: undefined } } })
    }
    if (s.partNumber) {
      chips.push({ key: 'specPn', label: `PN: ${s.partNumber}`, clear: { specs: { ...s, partNumber: undefined } } })
    }
    if (s.compatibleModel) {
      chips.push({ key: 'specModel', label: `Model: ${s.compatibleModel}`, clear: { specs: { ...s, compatibleModel: undefined } } })
    }
    if (s.material) {
      chips.push({ key: 'specMat', label: `Material: ${s.material}`, clear: { specs: { ...s, material: undefined } } })
    }
    if (s.threadSize) {
      chips.push({ key: 'specThread', label: `Thread: ${s.threadSize}`, clear: { specs: { ...s, threadSize: undefined } } })
    }
    if (s.portSize) {
      chips.push({ key: 'specPort', label: `Port: ${s.portSize}`, clear: { specs: { ...s, portSize: undefined } } })
    }
    if (s.tolerance) {
      chips.push({ key: 'specTol', label: `Tolerance: ${s.tolerance}`, clear: { specs: { ...s, tolerance: undefined } } })
    }
    if (s.location) {
      chips.push({ key: 'specLoc', label: `Location: ${s.location}`, clear: { specs: { ...s, location: undefined } } })
    }

    const addRangeChip = (key: string, name: string, fieldKey: keyof DetailedSpecFilters, range?: NumericRangeSpec) => {
      if (!range) return
      const hasMin = range.min !== undefined && range.min !== ''
      const hasMax = range.max !== undefined && range.max !== ''
      if (!hasMin && !hasMax) return
      const unitStr = range.unit ? ` ${range.unit}` : ''
      let text = ''
      if (hasMin && hasMax) text = `${name}: ${range.min} - ${range.max}${unitStr}`
      else if (hasMin) text = `${name}: ≥ ${range.min}${unitStr}`
      else text = `${name}: ≤ ${range.max}${unitStr}`
      chips.push({
        key,
        label: text,
        clear: { specs: { ...s, [fieldKey]: undefined } },
      })
    }

    addRangeChip('spec_diameter', 'Diameter', 'diameter', s.diameter)
    addRangeChip('spec_length', 'Length', 'length', s.length)
    addRangeChip('spec_width', 'Width', 'width', s.width)
    addRangeChip('spec_height', 'Height', 'height', s.height)
    addRangeChip('spec_weight', 'Weight', 'weight', s.weight)
    addRangeChip('spec_pressure', 'Pressure', 'pressure', s.pressure)
    addRangeChip('spec_temperature', 'Temperature', 'temperature', s.temperature)
    addRangeChip('spec_voltage', 'Voltage', 'voltage', s.voltage)
    addRangeChip('spec_current', 'Current', 'current', s.current)
    addRangeChip('spec_power', 'Power', 'power', s.power)
    addRangeChip('spec_flowRate', 'Flow Rate', 'flowRate', s.flowRate)
    addRangeChip('spec_speed', 'Speed', 'speed', s.speed)
    addRangeChip('spec_price', 'Price', 'price', s.price)
  }

  return chips
}

type CategoryDomainProfile = 'valves_pumps' | 'bearings_mechanical' | 'electrical_power' | 'automotive_machinery' | 'all'

interface FilterPanelProps {
  refinements: SearchRefinements
  paging: SearchPaging
  facets: Loaded<Facets> | null
  onRefinements: (next: SearchRefinements) => void
  onSort: (sort: SortKey) => void
  onPageSize: (size: number) => void
  onClear: () => void
  onTransferToResearch?: (specsQuery: string) => void
}

export function FilterPanel({
  refinements,
  paging,
  facets,
  onRefinements,
  onSort,
  onPageSize,
  onClear,
  onTransferToResearch,
}: FilterPanelProps) {
  const panelId = useId()
  const specListId = useId()
  const [open, setOpen] = useState(true)

  // Local draft states
  const [specLabel, setSpecLabel] = useState(refinements.specLabel)
  const [specValue, setSpecValue] = useState(refinements.specValue)
  const [specsDraft, setSpecsDraft] = useState<DetailedSpecFilters>(refinements.specs || {})

  // Category-aware profile selection
  const detectInitialProfile = (cat: string): CategoryDomainProfile => {
    const lower = cat.toLowerCase()
    if (lower.includes('valve') || lower.includes('pump') || lower.includes('hydraulic') || lower.includes('pneumatic') || lower.includes('seal')) {
      return 'valves_pumps'
    }
    if (lower.includes('bearing') || lower.includes('gear') || lower.includes('roller') || lower.includes('mechanical')) {
      return 'bearings_mechanical'
    }
    if (lower.includes('electrical') || lower.includes('voltage') || lower.includes('power') || lower.includes('semiconductor') || lower.includes('motor drive') || lower.includes('mcu')) {
      return 'electrical_power'
    }
    if (lower.includes('brake') || lower.includes('auto') || lower.includes('filter') || lower.includes('engine')) {
      return 'automotive_machinery'
    }
    return 'all'
  }

  const [activeProfile, setActiveProfile] = useState<CategoryDomainProfile>(() => detectInitialProfile(refinements.category))

  useEffect(() => {
    setSpecLabel(refinements.specLabel)
  }, [refinements.specLabel])

  useEffect(() => {
    setSpecValue(refinements.specValue)
  }, [refinements.specValue])

  useEffect(() => {
    setSpecsDraft(refinements.specs || {})
    if (refinements.category) {
      setActiveProfile(detectInitialProfile(refinements.category))
    }
  }, [refinements.specs, refinements.category])

  const data = facets?.status === 'ok' ? facets.data : null
  const categoryOptions: SelectOption[] = [
    { value: '', label: 'All categories' },
    ...(data?.categories ?? []).map((c) => ({ value: c.value, label: `${c.value} (${c.count})` })),
  ]
  const availabilityOptions: SelectOption[] = [
    { value: '', label: 'Any availability' },
    ...availabilityOrder.map((a) => {
      const count = data?.availability.find((f) => f.value === a)?.count
      return { value: a, label: `${availabilityMeta[a].label}${count !== undefined ? ` (${count})` : ''}` }
    }),
  ]

  const chips = activeChips(refinements)

  const updateDraftRange = (field: keyof DetailedSpecFilters, rangeKey: 'min' | 'max' | 'unit', val: string) => {
    setSpecsDraft((prev) => {
      const existing = (prev[field] as NumericRangeSpec) || {}
      return {
        ...prev,
        [field]: {
          ...existing,
          [rangeKey]: val,
        },
      }
    })
  }

  const applyAllFilters = (e?: FormEvent) => {
    e?.preventDefault()
    onRefinements({
      ...refinements,
      specLabel: specLabel.trim(),
      specValue: specValue.trim(),
      specs: { ...specsDraft },
    })
  }

  // Construct query string for Live Web Research from partial specs
  const handleTransferToResearch = () => {
    const parts: string[] = []
    if (specsDraft.manufacturer) parts.push(specsDraft.manufacturer)
    if (specsDraft.partNumber) parts.push(specsDraft.partNumber)
    if (refinements.category) parts.push(refinements.category)
    if (specsDraft.diameter?.min || specsDraft.diameter?.max) parts.push(`${specsDraft.diameter.min || specsDraft.diameter.max}${specsDraft.diameter.unit || 'mm'} dia`)
    if (specsDraft.pressure?.min || specsDraft.pressure?.max) parts.push(`${specsDraft.pressure.min || specsDraft.pressure.max}${specsDraft.pressure.unit || 'bar'}`)
    if (specsDraft.flowRate?.min || specsDraft.flowRate?.max) parts.push(`${specsDraft.flowRate.min || specsDraft.flowRate.max}${specsDraft.flowRate.unit || 'L/min'}`)
    if (specsDraft.voltage?.min || specsDraft.voltage?.max) parts.push(`${specsDraft.voltage.min || specsDraft.voltage.max}${specsDraft.voltage.unit || 'V'}`)
    if (specsDraft.power?.min || specsDraft.power?.max) parts.push(`${specsDraft.power.min || specsDraft.power.max}${specsDraft.power.unit || 'kW'}`)
    if (specsDraft.material) parts.push(specsDraft.material)
    if (specsDraft.compatibleModel) parts.push(specsDraft.compatibleModel)

    const query = parts.filter(Boolean).join(' ') || specLabel || specValue || 'datasheet specifications'
    if (onTransferToResearch) {
      onTransferToResearch(query)
    }
  }

  return (
    <Card aria-label="Filters and sorting" className="border-line shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex items-center gap-2 rounded-md text-sm font-semibold text-ink-900"
        >
          <SlidersHorizontal className="h-4 w-4 text-brand-600" aria-hidden="true" />
          Technical Specification Filters &amp; Sorting
          {chips.length > 0 && (
            <span className="rounded-full bg-brand-600 px-2 py-0.5 font-mono text-xs text-white" aria-label={`${chips.length} active`}>
              {chips.length}
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-ink-400" /> : <ChevronDown className="h-4 w-4 text-ink-400" />}
        </button>

        <div className="flex items-center gap-2">
          {chips.length > 0 && (
            <Button variant="ghost" size="sm" icon={<FilterX className="h-4 w-4" aria-hidden="true" />} onClick={onClear}>
              Clear all filters ({chips.length})
            </Button>
          )}
        </div>
      </div>

      {chips.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Active filters">
          {chips.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                onClick={() => onRefinements({ ...refinements, ...chip.clear })}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-500 bg-brand-50 py-1 pl-3 pr-2 text-xs font-medium text-brand-700 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-300 dark:border-brand-700"
                aria-label={`Remove filter ${chip.label}`}
              >
                {chip.label}
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div id={panelId} className={open ? 'mt-4 block' : 'mt-4 hidden lg:block'}>
        {/* Core Global Refinements Bar */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data ? (
            <Select
              label="Product Category"
              value={refinements.category}
              options={categoryOptions}
              onChange={(e) => {
                const cat = e.target.value
                onRefinements({ ...refinements, category: cat })
                setActiveProfile(detectInitialProfile(cat))
              }}
            />
          ) : (
            <Input
              label="Product Category"
              value={refinements.category}
              placeholder="e.g. Valves, Bearings, Seals"
              onChange={(e) => onRefinements({ ...refinements, category: e.target.value })}
            />
          )}

          <Select
            label="Availability"
            value={refinements.availability}
            options={availabilityOptions}
            onChange={(e) => onRefinements({ ...refinements, availability: e.target.value as SearchRefinements['availability'] })}
          />

          <Select label="Sort by" value={paging.sort} options={SORT_OPTIONS} onChange={(e) => onSort(e.target.value as SortKey)} />

          <Select
            label="Results per page"
            value={String(paging.pageSize)}
            options={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
            onChange={(e) => onPageSize(Number(e.target.value))}
          />
        </div>

        {/* Dynamic Category Profile Selector */}
        <div className="mt-5 border-t border-line pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">
              Category-Aware Specification Filters:
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setActiveProfile('valves_pumps')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeProfile === 'valves_pumps'
                    ? 'bg-brand-600 text-white'
                    : 'bg-surface-muted text-ink-700 hover:bg-surface-hover'
                }`}
              >
                <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
                Valves &amp; Pumps
              </button>
              <button
                type="button"
                onClick={() => setActiveProfile('bearings_mechanical')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeProfile === 'bearings_mechanical'
                    ? 'bg-brand-600 text-white'
                    : 'bg-surface-muted text-ink-700 hover:bg-surface-hover'
                }`}
              >
                <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
                Bearings &amp; Mechanical
              </button>
              <button
                type="button"
                onClick={() => setActiveProfile('electrical_power')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeProfile === 'electrical_power'
                    ? 'bg-brand-600 text-white'
                    : 'bg-surface-muted text-ink-700 hover:bg-surface-hover'
                }`}
              >
                <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
                Electrical &amp; Power
              </button>
              <button
                type="button"
                onClick={() => setActiveProfile('automotive_machinery')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeProfile === 'automotive_machinery'
                    ? 'bg-brand-600 text-white'
                    : 'bg-surface-muted text-ink-700 hover:bg-surface-hover'
                }`}
              >
                <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                Automotive &amp; Machinery
              </button>
              <button
                type="button"
                onClick={() => setActiveProfile('all')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeProfile === 'all'
                    ? 'bg-brand-600 text-white'
                    : 'bg-surface-muted text-ink-700 hover:bg-surface-hover'
                }`}
              >
                <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                All Specifications
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Category-Aware Fields Form */}
        <form onSubmit={applyAllFilters} className="mt-4 space-y-4 rounded-lg bg-surface-muted/40 p-4 border border-line">
          {/* Universal Identification Fields */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Manufacturer / Brand"
              value={specsDraft.manufacturer ?? ''}
              onChange={(e) => setSpecsDraft((prev) => ({ ...prev, manufacturer: e.target.value }))}
              placeholder="e.g. SKF, Parker, Festo"
            />
            <Input
              label="Part Number / Model"
              value={specsDraft.partNumber ?? ''}
              onChange={(e) => setSpecsDraft((prev) => ({ ...prev, partNumber: e.target.value }))}
              placeholder="e.g. 6205, D1VW, SK-80"
            />
            <Input
              label="Compatible Machine / Model"
              value={specsDraft.compatibleModel ?? ''}
              onChange={(e) => setSpecsDraft((prev) => ({ ...prev, compatibleModel: e.target.value }))}
              placeholder="e.g. Haas VF-2, Cat 320D"
            />
            <Input
              label="Location / Dispatch Origin"
              value={specsDraft.location ?? ''}
              onChange={(e) => setSpecsDraft((prev) => ({ ...prev, location: e.target.value }))}
              placeholder="e.g. US Warehouse, Germany"
            />
          </div>

          {/* 1. Valves & Pumps Profile */}
          {(activeProfile === 'valves_pumps' || activeProfile === 'all') && (
            <div className="rounded-md border border-line bg-surface p-3.5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-brand-800 dark:text-brand-300">
                <Gauge className="h-4 w-4" />
                <span>Fluid Power &amp; Pressure Specifications (Valves, Pumps, Cylinders)</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {/* Operating Pressure */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-700">Operating Pressure</label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={specsDraft.pressure?.min ?? ''}
                      onChange={(e) => updateDraftRange('pressure', 'min', e.target.value)}
                    />
                    <span className="text-ink-400 text-xs">to</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={specsDraft.pressure?.max ?? ''}
                      onChange={(e) => updateDraftRange('pressure', 'max', e.target.value)}
                    />
                    <Select
                      label="Pressure unit"
                      hideLabel
                      value={specsDraft.pressure?.unit ?? 'bar'}
                      onChange={(e) => updateDraftRange('pressure', 'unit', e.target.value)}
                      options={[
                        { value: 'bar', label: 'bar' },
                        { value: 'psi', label: 'PSI' },
                        { value: 'mpa', label: 'MPa' },
                      ]}
                    />
                  </div>
                </div>

                {/* Flow Rate */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-700">Flow Rate</label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={specsDraft.flowRate?.min ?? ''}
                      onChange={(e) => updateDraftRange('flowRate', 'min', e.target.value)}
                    />
                    <span className="text-ink-400 text-xs">to</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={specsDraft.flowRate?.max ?? ''}
                      onChange={(e) => updateDraftRange('flowRate', 'max', e.target.value)}
                    />
                    <Select
                      label="Flow rate unit"
                      hideLabel
                      value={specsDraft.flowRate?.unit ?? 'l/min'}
                      onChange={(e) => updateDraftRange('flowRate', 'unit', e.target.value)}
                      options={[
                        { value: 'l/min', label: 'L/min' },
                        { value: 'gpm', label: 'GPM' },
                        { value: 'm3/h', label: 'm³/h' },
                      ]}
                    />
                  </div>
                </div>

                {/* Port Size */}
                <div>
                  <Input
                    label="Port Size"
                    value={specsDraft.portSize ?? ''}
                    onChange={(e) => setSpecsDraft((prev) => ({ ...prev, portSize: e.target.value }))}
                    placeholder={'e.g. 1/4" NPT, 3/8", G 1/2'}
                  />
                </div>

                {/* Thread Size / Type */}
                <div>
                  <Input
                    label="Thread Size / Type"
                    value={specsDraft.threadSize ?? ''}
                    onChange={(e) => setSpecsDraft((prev) => ({ ...prev, threadSize: e.target.value }))}
                    placeholder="e.g. NPT, BSPP, Metric M18x1.5"
                  />
                </div>

                {/* Material */}
                <div>
                  <Input
                    label="Material"
                    value={specsDraft.material ?? ''}
                    onChange={(e) => setSpecsDraft((prev) => ({ ...prev, material: e.target.value }))}
                    placeholder="e.g. Stainless Steel 316, Brass, NBR, Viton"
                  />
                </div>

                {/* Temperature Range */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-700">Operating Temperature</label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={specsDraft.temperature?.min ?? ''}
                      onChange={(e) => updateDraftRange('temperature', 'min', e.target.value)}
                    />
                    <span className="text-ink-400 text-xs">to</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={specsDraft.temperature?.max ?? ''}
                      onChange={(e) => updateDraftRange('temperature', 'max', e.target.value)}
                    />
                    <Select
                      label="Temperature unit"
                      hideLabel
                      value={specsDraft.temperature?.unit ?? '°C'}
                      onChange={(e) => updateDraftRange('temperature', 'unit', e.target.value)}
                      options={[
                        { value: '°C', label: '°C' },
                        { value: '°F', label: '°F' },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Bearings & Mechanical Profile */}
          {(activeProfile === 'bearings_mechanical' || activeProfile === 'all') && (
            <div className="rounded-md border border-line bg-surface p-3.5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-brand-800 dark:text-brand-300">
                <Wrench className="h-4 w-4" />
                <span>Mechanical &amp; Dimensional Specifications (Bearings, Seals, Bushings)</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {/* Diameter */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-700">Diameter (Bore/OD)</label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={specsDraft.diameter?.min ?? ''}
                      onChange={(e) => updateDraftRange('diameter', 'min', e.target.value)}
                    />
                    <span className="text-ink-400 text-xs">-</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={specsDraft.diameter?.max ?? ''}
                      onChange={(e) => updateDraftRange('diameter', 'max', e.target.value)}
                    />
                    <Select
                      label="Diameter unit"
                      hideLabel
                      value={specsDraft.diameter?.unit ?? 'mm'}
                      onChange={(e) => updateDraftRange('diameter', 'unit', e.target.value)}
                      options={[
                        { value: 'mm', label: 'mm' },
                        { value: 'in', label: 'in' },
                      ]}
                    />
                  </div>
                </div>

                {/* Length, Width, Height */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-700">Width / Thickness (mm)</label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={specsDraft.width?.min ?? ''}
                      onChange={(e) => updateDraftRange('width', 'min', e.target.value)}
                    />
                    <span className="text-ink-400 text-xs">-</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={specsDraft.width?.max ?? ''}
                      onChange={(e) => updateDraftRange('width', 'max', e.target.value)}
                    />
                  </div>
                </div>

                {/* RPM / Speed */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-700">RPM / Max Speed</label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      placeholder="Min RPM"
                      value={specsDraft.speed?.min ?? ''}
                      onChange={(e) => updateDraftRange('speed', 'min', e.target.value)}
                    />
                    <span className="text-ink-400 text-xs">-</span>
                    <Input
                      type="number"
                      placeholder="Max RPM"
                      value={specsDraft.speed?.max ?? ''}
                      onChange={(e) => updateDraftRange('speed', 'max', e.target.value)}
                    />
                  </div>
                </div>

                {/* Tolerance */}
                <div>
                  <Input
                    label="Tolerance / Precision"
                    value={specsDraft.tolerance ?? ''}
                    onChange={(e) => setSpecsDraft((prev) => ({ ...prev, tolerance: e.target.value }))}
                    placeholder="e.g. ABEC-3, ABEC-5, P6, ±0.01mm"
                  />
                </div>

                {/* Weight */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-700">Weight</label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={specsDraft.weight?.min ?? ''}
                      onChange={(e) => updateDraftRange('weight', 'min', e.target.value)}
                    />
                    <span className="text-ink-400 text-xs">-</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={specsDraft.weight?.max ?? ''}
                      onChange={(e) => updateDraftRange('weight', 'max', e.target.value)}
                    />
                    <Select
                      label="Weight unit"
                      hideLabel
                      value={specsDraft.weight?.unit ?? 'g'}
                      onChange={(e) => updateDraftRange('weight', 'unit', e.target.value)}
                      options={[
                        { value: 'g', label: 'g' },
                        { value: 'kg', label: 'kg' },
                        { value: 'lb', label: 'lb' },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. Electrical & Power Profile */}
          {(activeProfile === 'electrical_power' || activeProfile === 'all') && (
            <div className="rounded-md border border-line bg-surface p-3.5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-brand-800 dark:text-brand-300">
                <Cpu className="h-4 w-4" />
                <span>Electrical &amp; Electronic Ratings (Power, Voltage, Current, Semiconductors)</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {/* Voltage */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-700">Voltage</label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      placeholder="Min V"
                      value={specsDraft.voltage?.min ?? ''}
                      onChange={(e) => updateDraftRange('voltage', 'min', e.target.value)}
                    />
                    <span className="text-ink-400 text-xs">to</span>
                    <Input
                      type="number"
                      placeholder="Max V"
                      value={specsDraft.voltage?.max ?? ''}
                      onChange={(e) => updateDraftRange('voltage', 'max', e.target.value)}
                    />
                    <Select
                      label="Voltage unit"
                      hideLabel
                      value={specsDraft.voltage?.unit ?? 'V'}
                      onChange={(e) => updateDraftRange('voltage', 'unit', e.target.value)}
                      options={[
                        { value: 'V', label: 'V' },
                        { value: 'mV', label: 'mV' },
                        { value: 'kV', label: 'kV' },
                      ]}
                    />
                  </div>
                </div>

                {/* Current */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-700">Current Rating</label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      placeholder="Min A"
                      value={specsDraft.current?.min ?? ''}
                      onChange={(e) => updateDraftRange('current', 'min', e.target.value)}
                    />
                    <span className="text-ink-400 text-xs">to</span>
                    <Input
                      type="number"
                      placeholder="Max A"
                      value={specsDraft.current?.max ?? ''}
                      onChange={(e) => updateDraftRange('current', 'max', e.target.value)}
                    />
                    <Select
                      label="Current unit"
                      hideLabel
                      value={specsDraft.current?.unit ?? 'A'}
                      onChange={(e) => updateDraftRange('current', 'unit', e.target.value)}
                      options={[
                        { value: 'A', label: 'A' },
                        { value: 'mA', label: 'mA' },
                      ]}
                    />
                  </div>
                </div>

                {/* Power Rating */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-700">Power Rating</label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      placeholder="Min W"
                      value={specsDraft.power?.min ?? ''}
                      onChange={(e) => updateDraftRange('power', 'min', e.target.value)}
                    />
                    <span className="text-ink-400 text-xs">to</span>
                    <Input
                      type="number"
                      placeholder="Max W"
                      value={specsDraft.power?.max ?? ''}
                      onChange={(e) => updateDraftRange('power', 'max', e.target.value)}
                    />
                    <Select
                      label="Power unit"
                      hideLabel
                      value={specsDraft.power?.unit ?? 'W'}
                      onChange={(e) => updateDraftRange('power', 'unit', e.target.value)}
                      options={[
                        { value: 'W', label: 'W' },
                        { value: 'kW', label: 'kW' },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form Action Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" variant="primary" icon={<Filter className="h-4 w-4" aria-hidden="true" />}>
                Apply Technical Specification Filters
              </Button>
              <Button
                type="button"
                variant="secondary"
                icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
                onClick={() => {
                  setSpecsDraft({})
                  setSpecLabel('')
                  setSpecValue('')
                  onRefinements({
                    category: refinements.category,
                    availability: refinements.availability,
                    specLabel: '',
                    specValue: '',
                  })
                }}
              >
                Reset Specs
              </Button>
            </div>

            {onTransferToResearch && (
              <Button
                type="button"
                variant="secondary"
                icon={<Sparkles className="h-4 w-4 text-accent-700" aria-hidden="true" />}
                onClick={handleTransferToResearch}
              >
                Research on Live Web using these Partial Specs
              </Button>
            )}
          </div>
        </form>

        {/* Custom Key=Value Freeform Spec Matcher */}
        <form onSubmit={applyAllFilters} className="mt-4 grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]" aria-label="Custom specification filter">
          <Input
            label="Custom Specification Label"
            value={specLabel}
            onChange={(e) => setSpecLabel(e.target.value)}
            placeholder="e.g. Dynamic load rating, Package, Thread"
            list={data && data.specLabels.length > 0 ? specListId : undefined}
            autoComplete="off"
            maxLength={80}
          />
          {data && data.specLabels.length > 0 && (
            <datalist id={specListId}>
              {data.specLabels.slice(0, 300).map((s) => (
                <option key={s.value} value={s.value} />
              ))}
            </datalist>
          )}
          <Input
            label="Value contains"
            value={specValue}
            onChange={(e) => setSpecValue(e.target.value)}
            placeholder="e.g. 45 kN, SOIC-8, M12"
            autoComplete="off"
            maxLength={80}
          />
          <Button type="submit" variant="secondary">
            Apply Custom Spec
          </Button>
        </form>

        <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            Partial specifications allow discovering matching components when the exact part number is unknown.
            Numeric ranges support automatic conversion across standard industrial units (e.g., bar &harr; PSI, &deg;C &harr; &deg;F, mm &harr; in).
          </span>
        </p>
      </div>
    </Card>
  )
}
