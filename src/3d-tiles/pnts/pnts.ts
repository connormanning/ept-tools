import { BatchTable } from '../batch-table'
import { FeatureTable } from '../feature-table'

import { Header } from './header'
import { Translate } from './types'

export * as Constants from './constants'
export { BatchTable, FeatureTable }
export function translate(params: Translate) {
  const {
    header: featureTableHeader,
    binary: featureTableBinary,
  } = FeatureTable.create(params)

  const {
    header: batchTableHeader,
    binary: batchTableBinary,
  } = BatchTable.create(params)

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
