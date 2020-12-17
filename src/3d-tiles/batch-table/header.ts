import { Params } from '3d-tiles/types'
import { Dimension, Schema } from 'ept'
import { EptToolsError } from 'types'

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

function getSize(type: Header.ComponentType) {
  switch (type) {
    case 'BYTE':
    case 'UNSIGNED_BYTE':
      return 1
    case 'SHORT':
    case 'UNSIGNED_SHORT':
      return 2
    case 'INT':
    case 'UNSIGNED_INT':
      return 4
    default:
      return 8
  }
}

function getComponentType(dim: Dimension): Header.ComponentType {
  if (dim.name === 'Intensity') return 'UNSIGNED_INT'

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

function create({
  view,
  options: { dimensions = [] },
}: Pick<Params, 'view' | 'options'>): Header | undefined {
  /*
  if (dimensions.length === 0) return

  let byteOffset = 0
  return dimensions.reduce<Header>((header, name) => {
    const dim = Schema.find(view.schema, name)
    if (!dim) throw new EptToolsError(`Missing required dimension: ${name}`)
    const componentType = getComponentType(dim)
    header[name] = { byteOffset, componentType, type: 'SCALAR' }
    byteOffset += view.length * getSize(componentType)
    return header
  }, {})
  */

  if (Schema.has(view.schema, 'Intensity')) {
    return {
      Intensity: {
        byteOffset: 0,
        componentType: 'UNSIGNED_BYTE',
        type: 'SCALAR',
      },
    }
  }
}
