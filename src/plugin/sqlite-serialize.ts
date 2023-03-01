import { isBoolean, isObject, isString } from '../util'

export type Serializer = (parameter: unknown) => unknown
export type Deserializer = (parameter: unknown) => unknown
export const defaultSerializer: Serializer = (parameter) => {
  return (parameter !== undefined && (isBoolean(parameter) || isObject(parameter)))
    ? JSON.stringify(parameter)
    : parameter
}
export const defaultDeserializer: Deserializer = (parameter) => {
  if (!isString(parameter)) {
    return parameter
  } else if (['true', 'false'].includes(parameter)) {
    return parameter === 'true'
  } else if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?$/.test(parameter)) {
    return new Date(parameter)
  } else {
    try {
      return JSON.parse(parameter)
    } catch (e) {
      return parameter
    }
  }
}
