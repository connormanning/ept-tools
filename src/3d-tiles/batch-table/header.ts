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
