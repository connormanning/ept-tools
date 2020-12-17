import { Params } from '3d-tiles/types'

import { Rgb } from './rgb'
import { Xyz } from './xyz'

export const Binary = { create }
function create(params: Params) {
  return Buffer.concat([Xyz.create(params), Rgb.create(params)])
}
