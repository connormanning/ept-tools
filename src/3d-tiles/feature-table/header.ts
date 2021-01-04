import { Point } from 'types'

type WithByteOffset = { byteOffset: number }

export declare namespace Header {
  export type Floating = {
    POSITION: WithByteOffset
  }
  export type Quantized = {
    POSITION_QUANTIZED: WithByteOffset
    QUANTIZED_VOLUME_OFFSET?: Point
    QUANTIZED_VOLUME_SCALE?: Point
  }
  export type WithBatchTable = {
    BATCH_LENGTH: number
    BATCH_ID: WithByteOffset
  }
}

type Base = (Header.Floating | Header.Quantized) & {
  // https://git.io/JIhyp
  POINTS_LENGTH: number
  RTC_CENTER?: Point
  CONSTANT_RGBA?: [number, number, number, number]

  // https://git.io/JIhSL
  RGBA?: WithByteOffset
  RGB?: WithByteOffset
  RGB565?: WithByteOffset
  NORMAL?: WithByteOffset
  NORMAL_OCT16P?: WithByteOffset
}

export type Header = Base | (Base & Header.WithBatchTable)
