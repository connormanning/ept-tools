import { Translate } from '../pnts/types'

export const Binary = { create }
function create(params: Translate) {
  return createIntensity(params)
}

function createIntensity({ view }: Translate) {
  if (!view.has('Intensity')) return Buffer.alloc(0)

  const { getter, length } = view
  const get = getter('Intensity')
  const buffer = Buffer.allocUnsafe(view.length)

  for (let index = 0; index < length; ++index) {
    buffer.writeUInt8(get(index), index)
  }
  return buffer
}
