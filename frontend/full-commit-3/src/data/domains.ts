import { CarFront, CircuitBoard, Factory } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Domain, DomainId } from '@/types'

export interface DomainWithIcon extends Domain {
  icon: LucideIcon
}

export const domains: DomainWithIcon[] = [
  {
    id: 'industrial',
    label: 'Industrial',
    description: 'Bearings, seals, pumps, motors and other components for industrial machinery.',
    examples: ['Hydraulic seals', 'Gearbox bearings', 'Servo motors'],
    icon: Factory,
  },
  {
    id: 'electronics',
    label: 'Electronics',
    description: 'ICs, passives, connectors and modules for boards and electronic assemblies.',
    examples: ['Voltage regulators', 'Connectors', 'Capacitors'],
    icon: CircuitBoard,
  },
  {
    id: 'automotive',
    label: 'Automotive',
    description: 'Brake, engine, filtration and electrical parts for passenger and commercial vehicles.',
    examples: ['Brake pads', 'Oil filters', 'Alternators'],
    icon: CarFront,
  },
]

export const domainById: Record<DomainId, DomainWithIcon> = {
  industrial: domains[0],
  electronics: domains[1],
  automotive: domains[2],
}

export function isDomainId(value: string | null): value is DomainId {
  return value === 'industrial' || value === 'electronics' || value === 'automotive'
}
