import { Point } from 'types'

const pointOffsetPosition = 32 * 3
const dataFormatIdPosition = pointOffsetPosition + 8
const legacyPointCountPosition = dataFormatIdPosition + 3
const scalePosition = pointOffsetPosition + 35
const offsetPosition = scalePosition + 24
const rangePosition = offsetPosition + 24

// This isn't the full header - just the selected fields we will actually use.
// See: https://www.asprs.org/a/society/committees/standards/LAS_1_4_r13.pdf.
export type Header = {
  pointOffset: number
  dataFormatId: number
  pointSize: number
  pointCount: number
  scale: Point
  offset: Point
  bounds: [...Point, ...Point]
}

export const Header = { parse }

function parse(buffer: Buffer): Header {
  return {
    pointOffset: buffer.readUInt32LE(pointOffsetPosition),
    dataFormatId: buffer.readUInt8(dataFormatIdPosition) & 0x3f,
    pointSize: buffer.readUInt16LE(dataFormatIdPosition + 1),
    pointCount: buffer.readUInt32LE(legacyPointCountPosition),
    scale: [
      buffer.readDoubleLE(scalePosition),
      buffer.readDoubleLE(scalePosition + 8),
      buffer.readDoubleLE(scalePosition + 16),
    ],
    offset: [
      buffer.readDoubleLE(offsetPosition),
      buffer.readDoubleLE(offsetPosition + 8),
      buffer.readDoubleLE(offsetPosition + 16),
    ],
    bounds: [
      buffer.readDoubleLE(rangePosition + 8),
      buffer.readDoubleLE(rangePosition + 8 + 16),
      buffer.readDoubleLE(rangePosition + 8 + 32),
      buffer.readDoubleLE(rangePosition),
      buffer.readDoubleLE(rangePosition + 16),
      buffer.readDoubleLE(rangePosition + 32),
    ],
  }
}
