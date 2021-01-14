import { Bounds, Ept, Hierarchy, Key, Schema, Srs } from 'ept'
import { EptToolsError } from 'types'

import { Options } from '../types'
import * as Constants from './constants'
import { Tile } from './tile'

export declare namespace Tileset {
  export type Create = {
    key: Key
    ept: Ept
    hierarchy: Hierarchy
    options: Partial<Options>
  }
  export type Version = '1.0'
  export type Asset = {
    version: Version
    [key: string]: unknown
  }
}

export type Tileset = {
  root: Tile
  geometricError: number
  asset: Tileset.Asset
  properties?: object
}
export const Tileset = { Constants, translate }

function translate({
  key,
  ept,
  hierarchy,
  options: { zOffset = 0, dimensions = [], truncate = false } = {},
}: Tileset.Create): Tileset {
  const rootGeometricError =
    Bounds.width(ept.bounds) / Constants.geometricErrorDivisor
  const geometricError = rootGeometricError / Math.pow(2, Key.depth(key))

  const bounds = Bounds.stepTo(Bounds.offsetHeight(ept.bounds, zOffset), key)
  const code = Srs.horizontalCodeString(ept.srs)
  if (!code) throw new EptToolsError('Cannot translate without an SRS code')

  // See "Tileset Properties" in section 2 of
  // https://github.com/CesiumGS/3d-tiles/blob/master/3d-tiles-overview.pdf.
  const root = Tile.translate({ bounds, code, hierarchy, key, geometricError })

  const metadata = {
    software: 'EPT Tools',
    ept,
    options: { zOffset, dimensions, truncate },
  }
  const asset: Tileset.Asset = {
    version: '1.0',
    ...(Key.depth(key) === 0 ? metadata : undefined),
  }

  return { root, geometricError, asset }
}
