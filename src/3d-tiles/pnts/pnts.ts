import { BatchTable } from '3d-tiles/batch-table'
import { FeatureTable } from '3d-tiles/feature-table'

import { Header } from './header'
import { Params } from './types'

export * as Constants from './constants'
export * from './types'

export { BatchTable, FeatureTable }
export function translate(params: Params) {
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
