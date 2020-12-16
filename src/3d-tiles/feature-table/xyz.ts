import { Bounds } from 'ept'

import * as Constants from '3d-tiles/pnts/constants'
import { Params } from '3d-tiles/pnts/types'

export const Xyz = { create }

function create({ view, tileBounds, toEcef }: Params) {
  const { getter, length } = view
  const getters = ['X', 'Y', 'Z'].map(getter)

  const buffer = Buffer.allocUnsafe(length * Constants.xyzSize)
  const mid = Bounds.mid(Bounds.reproject(tileBounds, toEcef))

  for (let index = 0, offset = 0; index < length; ++index) {
    const [x, y, z] = getters.map((get) => get(index))
    toEcef([x, y, z]).forEach((v, i) => {
      buffer.writeFloatLE(v - mid[i], offset)
      offset += 4
    })
  }

  return buffer
}
