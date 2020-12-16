import { Bounds } from 'ept'
import { View } from 'types'
import { Reproject } from 'utils'

export type Addon = [string, string]
export type Addons = Addon[]
export type Options = {
  zOffset: number
  dimensions: string[]
  addons: Addons
}

export type Params = {
  view: View
  tileBounds: Bounds
  toEcef: Reproject
  options: Partial<Options>
}
