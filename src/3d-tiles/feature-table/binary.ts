import { Translate } from '3d-tiles/pnts/types'

import { Rgb } from './rgb'
import { Xyz } from './xyz'

export const Binary = { create }
function create(params: Translate) {
  return Buffer.concat([Xyz.create(params), Rgb.create(params)])
}
