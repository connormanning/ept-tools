import proj from 'fatproj'

type Point2d = [number, number]
type Point3d = [number, number, number]

export type Reproject = <P = Point2d | Point3d>(p: P) => P
export const Reproject = { create }

function create(src: string, dst = 'EPSG:4326'): Reproject {
  return proj(src, dst).forward as Reproject
}
