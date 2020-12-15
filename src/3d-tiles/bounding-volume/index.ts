import { Box } from './box'
import { Region } from './region'
import { Sphere } from './sphere'

declare namespace Exports {
  export type { Box, Region, Sphere }
}

export declare namespace BoundingVolume {
  export type Box = Exports.Box
  export type Region = Exports.Region
  export type Sphere = Exports.Sphere
}

export type BoundingVolume =
  | { box: Box }
  | { region: Region }
  | { sphere: Sphere }

export const BoundingVolume = { Box, Region, Sphere }
