import { Dimension } from './dimension'
import { Schema } from './schema'

import { EptToolsError } from 'types'
import { Bytes, Scale } from 'utils'

export declare namespace View {
  export type Getter = (index: number) => number
  export type Getters = { [name: string]: Getter | undefined }

  export type Setter = (value: number, index: number) => void
  export type Setters = { [name: string]: Setter | undefined }

  export type Base = { schema: Schema; length: number }
  export type Readable = Base & { getter: (name: string) => Getter }
  export type Writable = Base & { setter: (name: string) => Setter }
}

export const View = {
  Readable: { create: createReadable },
  Writable: { create: createWritable },
}

function getLength(buffer: Buffer, schema: Schema): number {
  const pointSize = Schema.pointSize(schema)

  if (pointSize === 0) {
    throw new EptToolsError(`Invalid schema point size: ${pointSize}`)
  }

  const length = buffer.length / pointSize
  if (buffer.length % pointSize !== 0) {
    throw new EptToolsError('Invalid buffer length for this schema')
  }

  return length
}

function extract<T>(map: { [name: string]: T | undefined }, name: string): T {
  const v = map[name]
  if (!v) throw new EptToolsError(`Invalid dimension: ${name}`)
  return v
}

function createReadable(buffer: Buffer, schema: Schema): View.Readable {
  const length = getLength(buffer, schema)
  const pointSize = Schema.pointSize(schema)

  const map = schema.reduce<View.Getters>((map, dim) => {
    const { scale = 1, offset = 0 } = dim
    const get = Bytes.getter(buffer, Dimension.ctype(dim))
    const dimOffset = Schema.offset(schema, dim.name)

    map[dim.name] = (index: number) => {
      if (index >= length) {
        throw new EptToolsError(`Invalid point index: ${index} >= ${length}`)
      }
      return Scale.unapply(get(index * pointSize + dimOffset), scale, offset)
    }
    return map
  }, {})

  const getter = (name: string) => extract(map, name)
  return { schema, length, getter }
}

function createWritable(buffer: Buffer, schema: Schema): View.Writable {
  const length = getLength(buffer, schema)
  const pointSize = Schema.pointSize(schema)

  const map = schema.reduce<View.Setters>((map, dim) => {
    const { scale = 1, offset = 0 } = dim
    const set = Bytes.setter(buffer, Dimension.ctype(dim))
    const dimOffset = Schema.offset(schema, dim.name)

    map[dim.name] = (value: number, index: number) => {
      if (index >= length) {
        throw new EptToolsError(`Invalid point index: ${index} >= ${length}`)
      }

      return set(
        Scale.apply(value, scale, offset),
        index * pointSize + dimOffset
      )
    }

    return map
  }, {})

  const setter = (name: string) => extract(map, name)
  return { schema, length, setter }
}