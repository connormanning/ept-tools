import { Bounds } from 'ept'

export type Region = [number, number, number, number, number, number]
export const Region = { fromWgs84 }

function fromWgs84([minx, miny, minz, maxx, maxy, maxz]: Bounds): Region {
  // https://git.io/fjXUz
  return [
    (minx * Math.PI) / 180,
    (miny * Math.PI) / 180,
    (maxx * Math.PI) / 180,
    (maxy * Math.PI) / 180,
    minz,
    maxz,
  ]
}
