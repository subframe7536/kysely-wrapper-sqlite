import type { Generated } from 'kysely'
import { SqliteDB, SqliteSerializePlugin } from '../src'
interface DB {
  test: TestTable
}
interface TestTable {
  id: Generated<number>
  person: { name: string } | null
  gender: boolean
  createAt: Date | null
  updateAt: Date | null
}

const db = new SqliteDB<DB>({
  path: ':memory:',
  tables: {
    test: {
      column: {
        id: { type: 'increments' },
        person: { type: 'object', defaultTo: { name: 'test' } },
        gender: { type: 'boolean', notNull: true },
        createAt: { type: 'date' },
        updateAt: { type: 'date' },
      },
      property: {
        primary: 'id', // sqlite only support one single/composite primary key,
        index: ['person', ['id', 'gender']],
        timestamp: {
          create: 'createAt',
        },
      },
    },
  },
  dropTableBeforeInit: true,
  plugins: [new SqliteSerializePlugin()],
  errorLogger: reason => console.error(reason),
  queryLogger: (queryInfo, time) => console.log(`${time}ms`, queryInfo.sql, queryInfo.parameters),
})
// manually generate table
db.init(true)
// will auto generate table
  .then(() => db.transaction(trx => trx.insertInto('test').values({ gender: false }).execute()))
// will auto generate table
  .then(() => db.exec(d => d.selectFrom('test').selectAll().execute()))
  .then((result) => {
    console.log('result:')
    console.log(result)
  })
  .then(() => {
    const { sql, parameters } = db.toSQL(d => d
      .selectFrom('test')
      .where('person', '=', { name: '1' })
      .selectAll(),
    )
    console.log(sql)
    console.log(parameters)
  })
