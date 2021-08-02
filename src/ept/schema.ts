import { Schema as JsonSchema } from 'ajv'
import { EptToolsError } from 'types'

import { Dimension } from './dimension'

export type Schema = Dimension[]
const schema: JsonSchema = {
  title: 'Attribute schema',
  description: 'Array of dimensions representing the point layout',
  type: 'array',
  items: Dimension.schema,
  minItems: 3, // XYZ must be present.
}
export const Schema = { schema, find, has, offset, pointSize }

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
