import { Bounds } from 'ept'
import { View } from 'types'
import { Reproject } from 'utils'

export type Translate = {
  view: View
  tileBounds: Bounds
  toEcef: Reproject
}
