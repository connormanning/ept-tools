import { Bounds, Hierarchy, Key, Step } from '../ept'
import { Reproject } from '../utils'

import { BoundingVolume } from './bounding-volume'
import { Refine } from './refine'

const steps: Step[] = [
  [0, 0, 0],
  [0, 0, 1],
  [0, 1, 0],
  [0, 1, 1],
  [1, 0, 0],
  [1, 0, 1],
  [1, 1, 0],
  [1, 1, 1],
]

export declare namespace Tile {
  type TranslateOptions = {
    bounds: Bounds
    code: string
    hierarchy: Hierarchy
    key: Key
    geometricError: number
  }
  export type Content = { uri: string }
}

export type Tile = {
  content: Tile.Content
  children?: Tile[]
  boundingVolume: BoundingVolume
  geometricError: number
  refine?: Refine
}

export const Tile = { translate }

function translate({
  bounds,
  code,
  hierarchy,
  key,
  geometricError,
}: Tile.TranslateOptions): Tile {
  const reproject = Reproject.create(code, 'EPSG:4326')
  const region = BoundingVolume.Region.fromWgs84(
    Bounds.reproject(bounds, reproject)
  )

  const children = steps.reduce<Tile[]>((children, step) => {
    const nextKey = Key.step(key, step)
    const points = hierarchy[Key.stringify(nextKey)]
    if (!points) return children
    const nextBounds = Bounds.step(bounds, step)

    children.push(
      translate({
        code,
        hierarchy,
        bounds: nextBounds,
        key: nextKey,
        geometricError: geometricError / 2,
      })
    )
    return children
  }, [])

  const points = hierarchy[Key.stringify(key)]
  const extension = points === -1 ? 'json' : 'pnts'

  const tile: Tile = {
    content: { uri: `${Key.stringify(key)}.${extension}` },
    boundingVolume: { region },
    geometricError,
    children,
  }
  if (Key.depth(key) === 0) tile.refine = 'ADD'
  return tile
}
