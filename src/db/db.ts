import Dexie, { type EntityTable } from 'dexie'
import type { Contract, Domain, Finding, Incident, Inspection, NonConformance, Permit, Person, Photo, Task, Training, Visit } from './types'

export class HseDB extends Dexie {
  inspections!: EntityTable<Inspection, 'id'>
  findings!: EntityTable<Finding, 'id'>
  incidents!: EntityTable<Incident, 'id'>
  permits!: EntityTable<Permit, 'id'>
  persons!: EntityTable<Person, 'id'>
  trainings!: EntityTable<Training, 'id'>
  tasks!: EntityTable<Task, 'id'>
  photos!: EntityTable<Photo, 'id'>
  domains!: EntityTable<Domain, 'id'>
  contracts!: EntityTable<Contract, 'id'>
  nonConformances!: EntityTable<NonConformance, 'id'>
  visits!: EntityTable<Visit, 'id'>

  constructor() {
    super('hseapp')
    this.version(1).stores({
      inspections: 'id, date, templateId, createdAt',
      findings: 'id, date, status, severity, inspectionId, createdAt',
      incidents: 'id, date, type, status, severity, createdAt',
      permits: 'id, number, type, status, startAt, endAt, createdAt',
      persons: 'id, name, unit, medicalExamExpiry, createdAt',
      trainings: 'id, personId, date, expiryDate, createdAt',
      tasks: 'id, dueDate, done, category, createdAt',
      photos: 'id, createdAt',
    })
    this.version(2).stores({
      domains: 'id, name, createdAt',
      contracts: 'id, name, domainId, active, createdAt',
      nonConformances: 'id, domainId, code, title, createdAt',
      visits: 'id, contractId, date, status, createdAt',
    })
  }
}

export const db = new HseDB()

export const TABLE_NAMES = [
  'inspections',
  'findings',
  'incidents',
  'permits',
  'persons',
  'trainings',
  'tasks',
  'domains',
  'contracts',
  'nonConformances',
  'visits',
] as const

export type TableName = (typeof TABLE_NAMES)[number]

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
