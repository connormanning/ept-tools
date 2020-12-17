import { Schema } from 'ept'
import * as Constants from '3d-tiles/pnts/constants'
import { Params } from '3d-tiles/types'

export const Rgb = { create }
function create({ view }: Pick<Params, 'view'>) {
  if (!Schema.has(view.schema, 'Red')) return Buffer.alloc(0)

  const { getter, length } = view
  const getters = ['Red', 'Green', 'Blue'].map(getter)

  const buffer = Buffer.allocUnsafe(length * Constants.rgbSize)

  for (let index = 0, offset = 0; index < length; ++index) {
    getters.forEach((get) => buffer.writeUInt8(get(index), offset++))
  }

  return buffer
}
