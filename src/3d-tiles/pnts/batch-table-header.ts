import { View } from '../../types'

type JsonSerializable =
  | number
  | string
  | boolean
  | null
  | { [key: string]: JsonSerializable }
  | JsonSerializable[]

export declare namespace BatchTableHeader {
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

  export type InlineValue = JsonSerializable[]
  export type BinaryValue = {
    byteOffset: number
    componentType: ComponentType
    type: Type
  }
  export type Value = InlineValue | BinaryValue

  export type Options = { view: View }
}
export type BatchTableHeader = { [name: string]: BatchTableHeader.Value }

export const BatchTableHeader = { create }

function create({
  view,
}: BatchTableHeader.Options): BatchTableHeader | undefined {
  if (view.has('Intensity')) {
    return {
      Intensity: {
        byteOffset: 0,
        componentType: 'UNSIGNED_BYTE',
        type: 'SCALAR',
      },
    }
  }
  return undefined
}
