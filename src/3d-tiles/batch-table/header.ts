import { Dimension, Schema, View } from 'ept'
import { Ctype } from 'types'

import { Params } from '3d-tiles/types'
import { padEnd } from '3d-tiles/utils'

type JsonSerializable =
  | number
  | string
  | boolean
  | null
  | { [key: string]: JsonSerializable }
  | JsonSerializable[]

export declare namespace Header {
  // https://git.io/JLtEm
  export type ComponentType =
    | 'BYTE'
    | 'UNSIGNED_BYTE'
    | 'SHORT'
    | 'UNSIGNED_SHORT'
    | 'INT'
    | 'UNSIGNED_INT'
    | 'FLOAT'
    | 'DOUBLE'
  export type Type = 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4'

  export type InlineDimension = JsonSerializable[]
  export type BinaryDimension = {
    byteOffset: number
    componentType: ComponentType
    type: Type
  }
  export type Dimension = InlineDimension | BinaryDimension
}

export type Header = { [name: string]: Header.Dimension }
export const Header = { create }

function getComponentType(dim: Dimension): Header.ComponentType {
  const ctype = Dimension.ctype(dim)
  switch (ctype) {
    case 'int8':
      return 'BYTE'
    case 'int16':
      return 'SHORT'
    case 'int32':
      return 'INT'
    case 'uint8':
      return 'UNSIGNED_BYTE'
    case 'uint16':
      return 'UNSIGNED_SHORT'
    case 'uint32':
      return 'UNSIGNED_INT'
    case 'float':
      return 'FLOAT'
    default:
      return 'DOUBLE'
  }
}

type Overrides = { [name: string]: Ctype | undefined }
const overrides: Overrides = { Intensity: 'uint8' }
function getOutputCtype({ name, type, size, scale = 1 }: Dimension): Ctype {
  // If we have an overridden type for this dimension, use that.
  const override = overrides[name]
  if (override) return override

  // For scaled values, we'll be using their absolute representation.
  if (scale !== 1) return 'double'

  // 3D Tiles doesn't allow 64-bit integral values, so use a double.
  if (size === 8 && type !== 'float') return 'double'

  // Otherwise use the stored size.
  return Dimension.ctype({ type, size })
}

function getOutputDimension(dimension: Dimension): Dimension {
  const ctype = getOutputCtype(dimension)
  const { name } = dimension
  return { name, ...Dimension.fromCtype(ctype) }
}

function createOne(readable: View.Readable, dimension: Dimension) {
  const { length } = readable
  const { name } = dimension
  const schema: Schema = [dimension]
  const buffer = Buffer.allocUnsafe(dimension.size * length)
  const writable = View.Writable.create(buffer, schema)
  const set = writable.setter(name)
  const get = readable.getter(name)

  for (let index = 0; index < length; ++index) {
    set(get(index), index)
  }
  return buffer
}

type BatchTable = { header: Header; binary: Buffer }
function create({
  view,
  options: { dimensions = [] },
}: Pick<Params, 'view' | 'options'>): BatchTable {
  let byteOffset = 0

  // TODO: Throw on missing dimension? Zero-fill?
  const table = dimensions
    .map((name) => Schema.find(view.schema, name))
    .filter((d): d is Dimension => Boolean(d))
    .reduce<BatchTable>(
      ({ header, binary }, dimension) => {
        const outputDimension = getOutputDimension(dimension)
        header[dimension.name] = {
          byteOffset,
          componentType: getComponentType(outputDimension),
          type: 'SCALAR',
        }

        const buffer = padEnd(createOne(view, outputDimension))
        byteOffset += buffer.length

        return {
          header,
          binary: Buffer.concat([binary, buffer]),
        }
      },
      { header: {}, binary: Buffer.alloc(0) }
    )

  return table
}
