import { Schema as JsonSchema } from 'ajv'

import { Bounds } from './bounds'
import { DataType } from './data-type'
import { HierarchyType } from './hierarchy-type'
import { Schema } from './schema'
import { Srs } from './srs'

export type Ept = {
  bounds: Bounds
  boundsConforming: Bounds
  dataType: DataType
  hierarchyType: HierarchyType
  points: number
  schema: Schema
  span: number
  srs?: Srs
  version: '1.0.0' | '1.0.1'
}

export const points = {
  title: 'Point count',
  description: 'Point count',
  type: 'integer',
  minimum: 0,
}

export const span = {
  title: 'Span',
  description: 'EPT node span: represents node resolution in one dimension',
  type: 'integer',
  exclusiveMinimum: 0,
}

export const version = {
  title: 'EPT version',
  description: 'EPT version',
  type: 'string',
  enum: ['1.0.0', '1.0.1'],
}

// SRS is not required.
const required = {
  bounds: Bounds.schema,
  boundsConforming: Bounds.schema,
  dataType: DataType.schema,
  hierarchyType: HierarchyType.schema,
  points,
  schema: Schema.schema,
  span,
  version,
}

const schema: JsonSchema = {
  title: 'EPT metadata',
  description: 'Top-level metadata for an EPT resource',
  type: 'object',
  properties: { ...required, srs: Srs.schema },
  required: Object.keys(required),
}

export const Ept = { schema }
