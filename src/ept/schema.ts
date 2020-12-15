import { EptToolsError } from '../types'

import { Dimension } from './dimension'

export type Schema = Dimension[]
export const Schema = { find, has, offset, pointSize }

function find(schema: Schema, name: string) {
  return schema.find((d) => d.name === name)
}

function has(schema: Schema, name: string) {
  return Boolean(find(schema, name))
}

function offset(schema: Schema, name: string) {
  const index = schema.findIndex((v) => v.name === name)
  if (index === -1) throw new EptToolsError(`Failed to find dimension: ${name}`)
  return schema.slice(0, index).reduce((offset, dim) => offset + dim.size, 0)
}

function pointSize(schema: Schema) {
  return schema.reduce((offset, dim) => offset + dim.size, 0)
}
