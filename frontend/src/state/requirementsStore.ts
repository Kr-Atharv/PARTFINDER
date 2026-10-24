import { useSyncExternalStore } from 'react'
import { emptyRequirements } from '@/lib/compatibility'
import type { RequirementInput } from '@/types/compatibility'

/**
 * In-memory store for the compatibility requirements.
 *
 * It lives at module level (outside React) so the values survive navigation to
 * Find Parts and back, the same way the comparison selection does, and it
 * resets on a full page reload. No browser storage is used.
 *
 * - draft:   what is currently typed in the form
 * - applied: the snapshot the user last submitted with "Assess compatibility"
 */
export interface RequirementsState {
  draft: RequirementInput
  applied: RequirementInput | null
}

let state: RequirementsState = { draft: emptyRequirements, applied: null }
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = () => state

export const requirementsActions = {
  setTarget(target: string) {
    state = { ...state, draft: { ...state.draft, target } }
    emit()
  },
  setValue(fieldId: string, value: string) {
    state = { ...state, draft: { ...state.draft, values: { ...state.draft.values, [fieldId]: value } } }
    emit()
  },
  apply() {
    state = { ...state, applied: { target: state.draft.target, values: { ...state.draft.values } } }
    emit()
  },
  reset() {
    state = { draft: emptyRequirements, applied: null }
    emit()
  },
}

export function useRequirements(): RequirementsState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
