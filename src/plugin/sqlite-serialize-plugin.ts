import type { KyselyPlugin, PluginTransformQueryArgs, PluginTransformResultArgs, QueryResult, RootOperationNode, UnknownRow } from 'kysely'
import type { QueryId } from 'kysely/dist/cjs/util/query-id'
import { isString } from '../util'
import { SerializeParametersTransformer } from './sqlite-serialize-transformer'
import type { Deserializer, Serializer } from './sqlite-serialize'
import { defaultDeserializer } from './sqlite-serialize'

export interface SerializeParametersPluginOptions {
  /**
   * Function responsible for serialization of parameters.
   * Defaults to `JSON.stringify` of boolean, objects and arrays.
   * @param parameter unknown
  */
  serializer?: Serializer
  /**
    * Function responsible for deserialization of parameters. No BigInt process
    *
    * `number`/`null` ignore
    *
    * `'true'` convert to `true`
    *
    * `/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?$/` convert to Date
    *
    * others convert to `JSON.parse`
    *
    * @param parameter unknown
    */
  deserializer?: Deserializer
  // deepDeserialize?: boolean
}

/**
 * reference from https://github.com/koskimas/kysely/pull/138
 *
 * The following example will return an error when using sqlite dialects, unless using this plugin:
 *
 * ```ts
 * interface Person {
 *   firstName: string
 *   lastName: string
 *   tags: string[]
 * }
 *
 * interface Database {
 *   person: Person
 * }
 *
 * const db = new Kysely<Database>({
 *   dialect: new SqliteDialect({
 *     database: new Database(":memory:"),
 *   }),
 *   plugins: [
 *     new SerializeParametersPlugin(),
 *   ],
 * })
 *
 * await db.insertInto('person')
 *   .values([{
 *     firstName: 'Jennifer',
 *     lastName: 'Aniston',
 *     tags: ['celebrity', 'actress'],
 *   }])
 *   .execute()
 * ```
 *
 *
 * You can also provide a custom serializer function:
 *
 * ```ts
 * const db = new Kysely<Database>({
 *   dialect: new SqliteDialect({
 *     database: new Database(":memory:"),
 *   }),
 *   plugins: [
 *     new SerializeParametersPlugin({
 *         serializer: (value) => {
 *             if (value instanceof Date) {
 *                 return formatDatetime(value)
 *             }
 *
 *             if (value !== null && typeof value === 'object') {
 *                 return JSON.stringify(value)
 *             }
 *
 *             return value
 *         }
 *     }),
 *   ],
 * })
 * ```
 */
export class SqliteSerializePlugin implements KyselyPlugin {
  readonly #serializeParametersTransformer: SerializeParametersTransformer
  readonly #deserializer: Deserializer
  // readonly #deep: boolean
  #data: WeakMap<QueryId, string>

  constructor(opt: SerializeParametersPluginOptions = {}) {
    // this.#deep = opt.deepDeserialize ?? false
    this.#serializeParametersTransformer = new SerializeParametersTransformer(
      opt.serializer,
    )
    this.#deserializer = opt.deserializer || defaultDeserializer
    this.#data = new WeakMap()
  }

  transformQuery(args: PluginTransformQueryArgs): RootOperationNode {
    const { node, queryId } = args
    if (node.kind === 'SelectQueryNode') {
      this.#data.set(queryId, node.kind)
    }
    return this.#serializeParametersTransformer.transformNode(args.node)
  }

  parseResult(rows: any[]): any[] {
    return rows.map((v) => {
      Object.keys(v).forEach(key =>
        v[key] = isString(v[key])
          ? this.#deserializer(v[key])
          : v[key],
      )
      return v
    })
  }

  async transformResult(
    args: PluginTransformResultArgs,
  ): Promise<QueryResult<UnknownRow>> {
    const { result, queryId } = args
    const { rows } = result
    const ctx = this.#data.get(queryId)
    if (rows && ctx === 'SelectQueryNode') {
      return {
        ...args.result,
        rows: this.parseResult(rows),
      }
    }
    return args.result
  }
}
