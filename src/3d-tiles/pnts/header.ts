import { EptToolsError } from '../../types'
import { pntsHeaderSize, pntsMagic, pntsVersion } from '../constants'

export const Header = { create }

export type Buffers = {
  featureTableHeader: Buffer
  featureTableBinary: Buffer
  batchTableHeader: Buffer
  batchTableBinary: Buffer
}
function create({
  featureTableHeader,
  featureTableBinary,
  batchTableHeader,
  batchTableBinary,
}: Buffers) {
  const buffer = Buffer.alloc(pntsHeaderSize)

  if (featureTableHeader.length % 8 !== 0) {
    throw new EptToolsError(
      `Invalid feature table JSON size: ${featureTableHeader.length}`
    )
  }
  if (featureTableBinary.length % 8 !== 0) {
    throw new EptToolsError(
      `Invalid feature table binary size: ${featureTableBinary.length}`
    )
  }
  if (batchTableHeader.length % 8 !== 0) {
    throw new EptToolsError(
      `Invalid batch table JSON size: ${batchTableHeader.length}`
    )
  }
  if (batchTableBinary.length % 8 !== 0) {
    throw new EptToolsError(
      `Invalid batch table binary size: ${batchTableBinary.length}`
    )
  }

  const total =
    pntsHeaderSize +
    featureTableHeader.length +
    featureTableBinary.length +
    batchTableHeader.length +
    batchTableBinary.length

  // https://git.io/fjP8k
  buffer.write(pntsMagic, 0, 'utf8')
  buffer.writeUInt32LE(pntsVersion, 4)
  buffer.writeUInt32LE(total, 8)
  buffer.writeUInt32LE(featureTableHeader.length, 12)
  buffer.writeUInt32LE(featureTableBinary.length, 16)
  buffer.writeUInt32LE(batchTableHeader.length, 20)
  buffer.writeUInt32LE(batchTableBinary.length, 24)
  return buffer
}
