import { Rgb } from './rgb'
import { Xyz } from './xyz'

import { Translate } from './types'

export const FeatureTableBinary = { create }
function create(params: Translate) {
  return Buffer.concat([Xyz.create(params), Rgb.create(params)])
}
