import { Ctype, EptToolsError } from '../types'

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
export const Dimension = { ctype }

function ctype({ type, size }: Dimension): Ctype {
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
