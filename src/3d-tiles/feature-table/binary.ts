import { Rgb } from '../pnts/rgb'
import { Xyz } from '../pnts/xyz'

import { Translate } from '../pnts/types'

export const Binary = { create }
function create(params: Translate) {
  return Buffer.concat([Xyz.create(params), Rgb.create(params)])
}
