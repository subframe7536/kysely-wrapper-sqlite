export const isObject = (value: any): value is object => typeof value === 'object' && value !== null
export const isString = (value: any): value is string => typeof value === 'string'
export const isBoolean = (value: any): value is boolean => typeof value === 'boolean'
