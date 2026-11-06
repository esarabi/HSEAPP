import parks from './parks.json'

export interface BuiltinCatalog {
  id: string
  name: string
  source: string
  items: {
    code: string
    title: string
    questionType?: string
    process?: string
    ncDescription?: string
    legalBasis?: string
    correctiveAction?: string
    score?: number | null
    criticality?: string
    deadline?: string
  }[]
}

export const BUILTIN_CATALOGS: BuiltinCatalog[] = [parks as BuiltinCatalog]
