# Kysely Sqlite Wrapper

kysely wrapper for sqlite

## features

- generate table by config
- auto serialize/deserialize
- auto insert create time and update time

## install

```shell
pnpm i better-sqlite3 kysely kysely-wrapper-sqlite
```

## example

```ts
import type { Generated } from 'kysely'
import { SqliteDB, SqliteSerializePlugin } from 'kysely-wrapper-sqlite'
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
        timestamp: true
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
// auto generate table
  .then(() => db.transaction(trx => trx.insertInto('test').values({ gender: false }).execute()))
// auto generate table
  .then(() => db.exec(d => d.selectFrom('test').selectAll().execute()))
  .then((result) => {
    console.log('result:')
    console.log(result)
  })
```

### log

```log
0.4383000135421753ms drop table if exists "test" []
0.23370003700256348ms create table if not exists "test" ("id" integer primary key autoincrement, "person" text default '{"name":"test"}', "gender" text not null, "createAt" date, "updateAt" date) []
0.18989992141723633ms create index if not exists "idx_person" on "test" ("person") []
0.18119990825653076ms create index if not exists "idx_id_gender" on "test" ("id", "gender") []
0.16439998149871826ms
      create trigger if not exists test_createAt
      after insert
      on "test"
      begin
        update "test"
        set "createAt" = datetime('now','localtime')
        where "id" = NEW."id";
      end
       []
0.1881999969482422ms
      create trigger if not exists test_updateAt
      after update
      on "test"
      begin
        update "test"
        set "updateAt" = datetime('now','localtime')
        where "id" = NEW."id";
      end
       []
0.06020009517669678ms begin []
1.2976999282836914ms insert into "test" ("gender") values (?) [ 'false' ]
0.043000102043151855ms commit []
0.16610002517700195ms select * from "test" []
result:
[
  {
    id: 1,
    person: { name: 'test' },
    gender: false,
    createAt: 2023-03-01T09:37:05.000Z,
    updateAt: 2023-03-01T09:37:05.000Z
  }
]
```

## todos

- [ ] logic delete
- [ ] browser dialect

## credit

- [trilogy](https://github.com/haltcase/trilogy)
- [kysely #138](https://github.com/koskimas/kysely/pull/138)