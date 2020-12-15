import { Point } from './point'

export type Sphere = [...Point, number]
export const Sphere = { create }

function create(center: Point, radius: number): Sphere {
  return [...center, radius]
}
