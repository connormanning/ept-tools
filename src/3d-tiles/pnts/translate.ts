import { BatchTableHeader } from './batch-table-header'
import { BatchTableBinary } from './batch-table-binary'
import { FeatureTable } from './feature-table'
import { FeatureTableBinary } from './feature-table-binary'
import { Header } from './header'
import { Translate } from './types'

export function translate(params: Translate) {
  const featureTableJson = padEnd(
    Buffer.from(JSON.stringify(FeatureTable.create(params))),
    0x20
  )
  const featureTableBinary = padEnd(FeatureTableBinary.create(params))

  const batchTableJson = padEnd(
    Buffer.from(JSON.stringify(BatchTableHeader.create(params)) || ''),
    0x20
  )
  const batchTableBinary = padEnd(BatchTableBinary.create(params))

  const header = Header.create({
    featureTableJson: featureTableJson.length,
    featureTableBinary: featureTableBinary.length,
    batchTableJson: batchTableJson.length,
    batchTableBinary: batchTableBinary.length,
  })

  return Buffer.concat([
    header,
    featureTableJson,
    featureTableBinary,
    batchTableJson,
    batchTableBinary,
  ])
}

// Both the feature table and the batch table JSON must be padded to a multiple
// of 8 bytes with the character 0x20.  Their binary complements must also be
// padded to a multiple of 8 bytes, but with any value.  We'll choose 0.
//
// See https://git.io/JIjB7 and https://git.io/JIjBj.
//
function padEnd(b: Buffer, c = 0): Buffer {
  const remainder = b.length % 8
  if (!remainder) return b
  return Buffer.concat([b, Buffer.alloc(8 - remainder, c)])
}
