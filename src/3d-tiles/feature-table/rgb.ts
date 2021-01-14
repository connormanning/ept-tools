import { Schema } from 'ept'
import * as Constants from '3d-tiles/pnts/constants'
import { Params } from '3d-tiles/types'

export const Rgb = { create }
function create({
  view,
  options: { truncate = false },
}: Pick<Params, 'view' | 'options'>) {
  if (!Schema.has(view.schema, 'Red')) return Buffer.alloc(0)

  const { getter, length } = view
  const shift = truncate ? 8 : 0
  const getters = ['Red', 'Green', 'Blue']
    .map(getter)
    .map((get) => (index: number) => get(index) >> shift)

  const buffer = Buffer.allocUnsafe(length * Constants.rgbSize)

  for (let index = 0, offset = 0; index < length; ++index) {
    getters.forEach((get) => buffer.writeUInt8(get(index), offset++))
  }

  return buffer
}
