import Ajv, { ValidateFunction } from 'ajv'

import { Ept } from './ept'
import { Hierarchy } from './hierarchy'

export const bounds = {
  title: 'Bounds',
  description:
    'Bounding volume of the form [xmin, ymin, zmin, xmax, ymax, zmax]',
  type: 'array',
  items: { type: 'number' },
  minItems: 6,
  maxItems: 6,
}

export const dataType = {
  title: 'Data type',
  description: 'Point data encoding',
  type: 'string',
  enum: ['binary', 'laszip', 'zstandard'],
}

export const hierarchyType = {
  title: 'Hierarchy type',
  description: 'Hierarchy data encoding',
  type: 'string',
  enum: ['json'],
}

export const points = {
  title: 'Point count',
  description: 'Point count',
  type: 'integer',
  minimum: 0,
}

export const dimension = {
  title: 'Dimension',
  description: 'Dimension layout information',
  type: 'object',
  properties: {
    name: {
      type: 'string',
    },
    type: {
      type: 'string',
      enum: ['signed', 'unsigned', 'float'],
    },
    size: {
      type: 'integer',
      enum: [1, 2, 4, 8],
    },
    scale: {
      type: 'number',
      exclusiveMinimum: 0,
      default: 1,
    },
    offset: {
      type: 'number',
      default: 0,
    },
  },
  allOf: [
    {
      if: { properties: { type: { const: 'float' } } },
      then: { properties: { size: { enum: [4, 8] } } },
    },
  ],
  required: ['name', 'type', 'size'],
}

export const schema = {
  title: 'Attribute schema',
  description: 'Array of dimensions representing the point layout',
  type: 'array',
  items: dimension,
  minItems: 3, // XYZ must be present.
}

export const span = {
  title: 'Span',
  description: 'EPT node span: represents node resolution in one dimension',
  type: 'integer',
  exclusiveMinimum: 0,
}

export const srs = {
  title: 'Spatial reference',
  description: 'Spatial reference codes and WKT',
  type: 'object',
  properties: {
    authority: { type: 'string' },
    horizontal: { type: 'string' },
    vertical: { type: 'string' },
    wkt: { type: 'string' },
  },
  dependencies: {
    authority: ['horizontal'],
    horizontal: ['authority'],
    vertical: ['horizontal'],
  },
}

export const version = {
  title: 'EPT version',
  description: 'EPT version',
  type: 'string',
  const: '1.0.0',
}

const required = {
  bounds,
  boundsConforming: bounds,
  dataType,
  hierarchyType,
  points,
  schema,
  span,
  version,
}
const properties = { ...required, srs }

// https://entwine.io/entwine-point-tile.html#ept-json
export const ept = {
  title: 'EPT metadata',
  description: 'Top-level metadata for an EPT resource',
  type: 'object',
  required: Object.keys(required),
  properties,
}

export const hierarchy = {
  title: 'EPT hierarchy',
  description: 'EPT hierarchy contents',
  type: 'object',
  propertyNames: { pattern: '^\\d+-\\d+-\\d+-\\d+' },
  patternProperties: {
    '.*': { type: 'integer' },
  },
}

const ajv = new Ajv()
const validate = {
  ept: ajv.compile(ept),
  hierarchy: ajv.compile(hierarchy),
}

export function parse(value: unknown) {
  return doValidate<Ept>(validate.ept, value)
}
export function parseHierarchy(value: unknown) {
  return doValidate<Hierarchy>(validate.hierarchy, value)
}

export type Validated<T> = [T, string[]]
function doValidate<T>(
  validate: ValidateFunction,
  value: unknown
): Validated<T> {
  const isValid = validate(value)
  const errors =
    isValid || !validate.errors
      ? []
      : validate.errors.map<string>((v) => {
          const prefix = schema.title || v.dataPath.slice(1)
          return (prefix.length ? `${prefix}: ` : '') + v.message
        })

  return [value as T, errors]
}
