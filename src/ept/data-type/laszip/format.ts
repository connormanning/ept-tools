import { Schema } from 'ept/schema'
import { EptToolsError } from 'types'

import { Header } from './header'

export function create(header: Header) {
  const { dataFormatId } = header
  switch (dataFormatId) {
    case 0:
      return create0(header)
    case 1:
      return create1(header)
    case 2:
      return create2(header)
    case 3:
      return create3(header)
    default:
      throw new EptToolsError(`Unsupported LAS data format: ${dataFormatId}`)
  }
}

function create0({ scale, offset }: Header): Schema {
  return [
    { name: 'X', type: 'signed', size: 4, scale: scale[0], offset: offset[0] },
    { name: 'Y', type: 'signed', size: 4, scale: scale[1], offset: offset[1] },
    { name: 'Z', type: 'signed', size: 4, scale: scale[2], offset: offset[2] },
    { name: 'Intensity', type: 'unsigned', size: 2 },
    { name: 'ScanFlags', type: 'unsigned', size: 1 },
    { name: 'Classification', type: 'unsigned', size: 1 },
    { name: 'ScanAngleRank', type: 'signed', size: 1 },
    { name: 'UserData', type: 'unsigned', size: 1 },
    { name: 'PointSourceId', type: 'unsigned', size: 2 },
  ]
}

const GpsTime: Schema = [{ name: 'GpsTime', type: 'float', size: 8 }]
const Rgb: Schema = [
  { name: 'Red', type: 'unsigned', size: 2 },
  { name: 'Green', type: 'unsigned', size: 2 },
  { name: 'Blue', type: 'unsigned', size: 2 },
]

function create1(header: Header): Schema {
  return [...create0(header), ...GpsTime]
}

function create2(header: Header): Schema {
  return [...create0(header), ...Rgb]
}

function create3(header: Header): Schema {
  return [...create0(header), ...GpsTime, ...Rgb]
}
