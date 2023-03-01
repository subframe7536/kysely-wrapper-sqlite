import type { KyselyPlugin } from 'kysely'
import type { CompiledQuery } from 'kysely/dist/cjs/query-compiler/compiled-query'

// todo))
export type DBOption = {
  platform: 'browser' | 'node'
  type: 'file' | 'indexeddb' | 'memory'
  path?: string
}
export type TriggerEvent = 'insert' | 'update' | 'delete'
export type column =
  | 'string'
  | 'boolean'
  | 'object'
  | 'number'
  | 'date'
  | 'increments'

export type ColumeOption<T> = {
  type: column
  defaultTo?: T
  notNull?: boolean
}
export type TableOption<T> = {
  primary?: keyof T | Array<keyof T>
  unique?: Array<keyof T | Array<keyof T>>
  index?: Array<keyof T | Array<keyof T>>
  timestamp?: boolean | { create?: keyof T; update?: keyof T }
}
export type Column<T> = {
  [k in keyof T]: ColumeOption<T[k]>
}
export type ITable<T> = {
  column: Column<Required<T>>
  property?: TableOption<T>
}
export type Tables<T> = {
  [Key in keyof T]: ITable<T[Key]>
}
export enum DBStatus {
  'needDrop',
  'noNeedDrop',
  'ready',
}
export type SqliteDBOption<T> = {
  path: string
  tables: Tables<T>
  dropTableBeforeInit?: boolean
  queryLogger?: (queryInfo: CompiledQuery, time: number) => any
  errorLogger?: (reason: unknown) => any
  plugins?: Array<KyselyPlugin>
}
