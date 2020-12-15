import { Bounds, Ept, Hierarchy, Key, Srs } from '../../ept'
import { EptToolsError } from '../../types'

import * as Constants from './constants'
import { Tile } from './tile'

export declare namespace Tileset {
  export type Create = { key: Key; ept: Ept; hierarchy: Hierarchy }
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

function translate({ key, ept, hierarchy }: Tileset.Create): Tileset {
  const rootGeometricError =
    Bounds.width(ept.bounds) / Constants.geometricErrorDivisor
  const geometricError = rootGeometricError / Math.pow(2, Key.depth(key))

  const bounds = Bounds.stepTo(ept.bounds, key)
  const code = Srs.horizontalCodeString(ept.srs)
  if (!code) throw new EptToolsError('Cannot translate without an SRS code')

  // TODO: For the root node, supply additional metadata in the "asset" and
  // "properties" key.  See "Tileset Properties" in section 2 of
  // https://github.com/CesiumGS/3d-tiles/blob/master/3d-tiles-overview.pdf.
  //
  // - EPT dimension statistics could go in "asset".
  // - EPT Tools "powered-by" and version info could go in "properties".
  // - Also user-supplied values?
  const root = Tile.translate({ bounds, code, hierarchy, key, geometricError })
  return { root, geometricError, asset: { version: '1.0' } }
}
