import { EptToolsError } from '../../types'
import { pntsHeaderSize, pntsMagic, pntsVersion } from '../constants'

export declare namespace Header {
  export type Sizes = {
    featureTableJson: number
    featureTableBinary: number
    batchTableJson: number
    batchTableBinary: number
  }
}
export const Header = { create }

function create(sizes: Header.Sizes) {
  const buffer = Buffer.alloc(pntsHeaderSize)

  if (sizes.featureTableJson % 8 !== 0) {
    throw new EptToolsError(
      `Invalid feature table JSON size: ${sizes.featureTableJson}`
    )
  }
  if (sizes.featureTableBinary % 8 !== 0) {
    throw new EptToolsError(
      `Invalid feature table binary size: ${sizes.featureTableBinary}`
    )
  }
  if (sizes.batchTableJson % 8 !== 0) {
    throw new EptToolsError(
      `Invalid batch table JSON size: ${sizes.batchTableJson}`
    )
  }
  if (sizes.batchTableBinary % 8 !== 0) {
    throw new EptToolsError(
      `Invalid batch table binary size: ${sizes.batchTableBinary}`
    )
  }

  const total =
    pntsHeaderSize +
    sizes.featureTableJson +
    sizes.featureTableBinary +
    sizes.batchTableJson +
    sizes.batchTableBinary

  // https://git.io/fjP8k
  buffer.write(pntsMagic, 0, 'utf8')
  buffer.writeUInt32LE(pntsVersion, 4)
  buffer.writeUInt32LE(total, 8)
  buffer.writeUInt32LE(sizes.featureTableJson, 12)
  buffer.writeUInt32LE(sizes.featureTableBinary, 16)
  buffer.writeUInt32LE(sizes.batchTableJson, 20)
  buffer.writeUInt32LE(sizes.batchTableBinary, 24)
  return buffer
}
