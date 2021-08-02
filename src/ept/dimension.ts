import { Schema } from 'ajv'

import { Ctype, EptToolsError } from 'types'

export declare namespace Dimension {
  export type Type = 'signed' | 'unsigned' | 'float'
  export type Size = 1 | 2 | 4 | 8

  export type Core = {
    name: string
    type: Dimension.Type
    size: Dimension.Size
    scale?: number
    offset?: number
  }

  export type Count = { value: number; count: number }
  export type Counts = Count[]

  export type Stats = {
    count: number
    minimum: number
    maximum: number
    mean: number
    stddev: number
    variance: number
    counts?: Counts
  }
}

export type Dimension = Dimension.Core | (Dimension.Core & Dimension.Stats)
const schema: Schema = {
  title: 'Dimension',
  description: 'Dimension details',
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
    count: { type: 'number' },
    minimum: { type: 'number' },
    maximum: { type: 'number' },
    mean: { type: 'number' },
    stddev: { type: 'number' },
    variance: { type: 'number' },
    counts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          value: { type: 'number' },
          count: { type: 'number' },
        },
        required: ['value', 'count'],
      },
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
export const Dimension = { schema, ctype, fromCtype }

function fromCtype(ctype: Ctype): Pick<Dimension, 'type' | 'size'> {
  switch (ctype) {
    case 'int8':
      return { type: 'signed', size: 1 }
    case 'int16':
      return { type: 'signed', size: 2 }
    case 'int32':
      return { type: 'signed', size: 4 }
    case 'int64':
      return { type: 'signed', size: 8 }
    case 'uint8':
      return { type: 'unsigned', size: 1 }
    case 'uint16':
      return { type: 'unsigned', size: 2 }
    case 'uint32':
      return { type: 'unsigned', size: 4 }
    case 'uint64':
      return { type: 'unsigned', size: 8 }
    case 'float':
      return { type: 'float', size: 4 }
    case 'double':
      return { type: 'float', size: 8 }
  }
}

function ctype({ type, size }: Pick<Dimension, 'type' | 'size'>): Ctype {
  switch (type) {
    case 'signed': {
      switch (size) {
        case 1:
          return 'int8'
        case 2:
          return 'int16'
        case 4:
          return 'int32'
        case 8:
          return 'int64'
      }
    }
    case 'unsigned': {
      switch (size) {
        case 1:
          return 'uint8'
        case 2:
          return 'uint16'
        case 4:
          return 'uint32'
        case 8:
          return 'uint64'
      }
    }
    case 'float': {
      switch (size) {
        case 4:
          return 'float'
        case 8:
          return 'double'
      }
    }
  }
  throw new EptToolsError(`Invalid dimension type/size: ${type}/${size}`)
}
