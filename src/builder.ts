import type { LogEvent, Transaction } from 'kysely'
import { Kysely, SqliteDialect, sql } from 'kysely'
import type { DataTypeExpression } from 'kysely/dist/cjs/parser/data-type-parser'
import Sqlite from 'better-sqlite3'
import { isBoolean, isString } from './util'
import { SqliteSerializePlugin } from './plugin/sqlite-serialize-plugin'
import type { ITable, SqliteDBOption, TriggerEvent } from './types'
import { DBStatus } from './types'

export class SqliteDB<DB extends Record<string, any>> {
  public kysely: Kysely<DB>
  private status: DBStatus
  private tableMap: Map<string, ITable<DB[Extract<keyof DB, string>]>>
  constructor(option: SqliteDBOption<DB>) {
    const { path, tables, dropTableBeforeInit: truncateBeforeInit, errorLogger, queryLogger, plugins } = option
    this.kysely = new Kysely<DB>({
      dialect: new SqliteDialect({
        database: new Sqlite(path),
        // database: () => initSqlJs({ locateFile: file => `${import.meta.url}/${file}` })
        //   .then(v => new v.Database()),
      }),
      log: (event: LogEvent) => {
        event.level === 'error'
          ? (errorLogger && errorLogger(event.error))
          : (queryLogger && queryLogger(event.query, event.queryDurationMillis))
      },
      plugins: plugins ?? [new SqliteSerializePlugin()],
    })
    this.status = truncateBeforeInit
      ? DBStatus.needDrop
      : DBStatus.noNeedDrop
    this.tableMap = new Map()
    for (const tableName in tables) {
      if (!Object.prototype.hasOwnProperty.call(tables, tableName)) {
        continue
      }
      const table = tables[tableName]
      this.tableMap.set(tableName, table)
    }
  }

  private async createTimeTrigger(table: keyof DB, event: TriggerEvent, column: string, key = 'rowid') {
    // datetime('now') will return UTC Time
    await sql`
      create trigger if not exists ${sql.raw(table as string)}_${sql.raw(column)}
      after ${sql.raw(event)}
      on ${sql.table(table as string)}
      begin
        update ${sql.table(table as string)}
        set ${sql.ref(column)} = datetime('now','localtime')
        where ${sql.ref(key)} = NEW.${sql.ref(key)};
      end
      `.execute(this.kysely).catch((err) => {
        console.error(err)
        return undefined
      })
  }

  public async init(dropTableBeforeInit = false) {
    for (const [tableName, table] of this.tableMap) {
      const { column: columnList, property: tableProperty } = table
      if (dropTableBeforeInit || this.status === DBStatus.needDrop) {
        await this.kysely.schema.dropTable(tableName).ifExists().execute().catch()
      }
      let tableSql = this.kysely.schema.createTable(tableName)
      let _triggerKey = 'rowid'
      let _haveAutoKey = false
      let _insertColumnName = 'createAt'
      let _updateColumnName = 'updateAt'
      if (tableProperty?.timestamp && !isBoolean(tableProperty.timestamp)) {
        const { create, update } = tableProperty.timestamp as { create?: string; update?: string }
        _insertColumnName = create ?? _insertColumnName
        _updateColumnName = update ?? _updateColumnName
      }
      for (const columnName in columnList) {
        if (!Object.prototype.hasOwnProperty.call(columnList, columnName)) {
          continue
        }
        const columnOption = columnList[columnName]
        let dataType: DataTypeExpression
        const { type, notNull, defaultTo } = columnOption
        switch (type) {
          case 'boolean':
          case 'date':
          case 'object':
          case 'string':
            dataType = 'text'
            break
          case 'increments':
            _triggerKey = columnName
          // eslint-disable-next-line no-fallthrough
          case 'number':
            dataType = 'integer'
        }
        if ([_insertColumnName, _updateColumnName].includes(columnName)) {
          continue
        }
        tableSql = tableSql.addColumn(columnName, dataType, (builder) => {
          if (type === 'increments') {
            _haveAutoKey = true
            return builder.autoIncrement().primaryKey()
          }
          notNull && (builder = builder.notNull())
          defaultTo !== undefined && (builder = builder.defaultTo(defaultTo))
          return builder
        })
      }
      if (tableProperty) {
        const _primary = tableProperty.primary as string | string[] | undefined
        const _unique = tableProperty.unique as string[] | (string[])[] | undefined
        if (tableProperty.timestamp) {
          tableSql = tableSql
            .addColumn(_insertColumnName, 'date')
            .addColumn(_updateColumnName, 'date')
        }
        if (!_haveAutoKey && _primary) {
          const is = isString(_primary)
          _triggerKey = is ? _primary : _primary[0]
          tableSql = tableSql.addPrimaryKeyConstraint(`pk_${is ? _primary : _primary.join('_')}`, (is ? [_primary] : _primary) as any)
        }
        _unique?.forEach((u: string | string[]) => {
          const is = isString(u)
          _triggerKey = (!_primary && !_haveAutoKey) ? is ? u : u[0] : _triggerKey
          tableSql = tableSql.addUniqueConstraint(`un_${is ? u : u.join('_')}`, (is ? [u] : u) as any)
        })
      }
      await tableSql.ifNotExists().execute()
      if (tableProperty?.index) {
        for (const i of tableProperty.index) {
          const is = isString(i)
          let _idx = this.kysely.schema.createIndex(`idx_${is ? i : (i as []).join('_')}`).on(tableName)
          _idx = is ? _idx.column(i) : _idx.columns(i as [])
          await _idx.ifNotExists().execute()
        }
      }
      if (tableProperty?.timestamp) {
        await this.createTimeTrigger(tableName, 'insert', _insertColumnName, _triggerKey)
        await this.createTimeTrigger(tableName, 'update', _updateColumnName, _triggerKey)
      }
    }
    this.status = DBStatus.ready
  }

  public async transaction<Return>(
    cb: (trx: Transaction<DB>) => Promise<Return>,
    errorLog = false,
  ) {
    this.status !== DBStatus.ready && await this.init()
    if (this.status !== DBStatus.ready) {
      throw new Error('fail to init table')
    }

    return await this.kysely.transaction().execute(cb)
      .catch((err) => {
        errorLog && console.error(err)
        return undefined
      })
  }

  public async exec<Return>(cb: (db: Kysely<DB>) => Promise<Return>) {
    this.status !== DBStatus.ready && await this.init()
    if (this.status !== DBStatus.ready) {
      throw new Error('fail to init table')
    }

    return await cb(this.kysely)
      .catch((err) => {
        console.error(err)
        return undefined
      })
  }
}
