import { BatchTableHeader } from './batch-table-header'
import { BatchTableBinary } from './batch-table-binary'
import { FeatureTableHeader } from './feature-table-header'
import { FeatureTableBinary } from './feature-table-binary'
import { Header } from './header'
import { Translate } from './types'
import { padEnd } from './utils'

export function translate(params: Translate) {
  const featureTableHeader = padEnd(
    Buffer.from(JSON.stringify(FeatureTableHeader.create(params))),
    0x20
  )
  const featureTableBinary = padEnd(FeatureTableBinary.create(params))

  const batchTableHeader = padEnd(
    Buffer.from(JSON.stringify(BatchTableHeader.create(params)) || ''),
    0x20
  )
  const batchTableBinary = padEnd(BatchTableBinary.create(params))

  const header = Header.create({
    featureTableHeader,
    featureTableBinary,
    batchTableHeader,
    batchTableBinary,
  })

  return Buffer.concat([
    header,
    featureTableHeader,
    featureTableBinary,
    batchTableHeader,
    batchTableBinary,
  ])
}
