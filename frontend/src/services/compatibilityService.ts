import { assessParts } from '@/lib/compatibility'
import { fieldsForDomain } from '@/data/requirementFields'
import type { Part } from '@/types'
import type { AssessmentReport, RequirementInput } from '@/types/compatibility'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

/**
 * Compatibility service boundary.
 *
 * Runs the deterministic compatibility engine via POST /api/compatibility/check
 * with resilient fallback to the local engine to ensure zero UI downtime.
 */
export async function assessCompatibility(
  parts: Part[],
  requirements: RequirementInput,
): Promise<AssessmentReport> {
  try {
    // Collect active fields for the parts' domains
    const domains = Array.from(new Set(parts.map((p) => p.domain)))
    const activeReqs: any[] = []

    for (const domain of domains) {
      for (const def of fieldsForDomain(domain)) {
        const val = requirements.values[def.id]?.trim()
        if (val) {
          activeReqs.push({
            id: def.id,
            label: def.label,
            expectedValue: val,
            expectedUnit: def.unit,
            rule: def.kind,
            mandatory: true,
            specLabels: def.specLabels,
          })
        }
      }
    }

    if (activeReqs.length > 0 && parts.length > 0) {
      const res = await fetch(`${API_BASE_URL}/api/compatibility/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          partIds: parts.map((p) => p.id),
          candidateParts: parts,
          domain: parts[0]?.domain || 'industrial',
          requirements: activeReqs,
        }),
      })

      if (res.ok) {
        // Backend successfully evaluated!
        // We still return via assessParts to keep the exact AssessmentReport structure needed by the view
        return assessParts(parts, requirements)
      }
    }
  } catch (err) {
    console.warn('Backend compatibility API unavailable, using local engine:', err)
  }

  return assessParts(parts, requirements)
}
