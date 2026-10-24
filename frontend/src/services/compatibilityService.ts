import { assessParts } from '@/lib/compatibility'
import type { Part } from '@/types'
import type { AssessmentReport, RequirementInput } from '@/types/compatibility'

/**
 * Compatibility service boundary.
 *
 * Today this runs the local, rule-based engine on demo data. It is async on
 * purpose, like searchParts, so a backend implementation can replace the body
 * later without changing any caller. There is no artificial delay: it resolves
 * as soon as the local calculation ends. No network request is made.
 */
export async function assessCompatibility(
  parts: Part[],
  requirements: RequirementInput,
): Promise<AssessmentReport> {
  return assessParts(parts, requirements)
}
