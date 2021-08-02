import { Schema } from 'ajv'
import { Point } from 'types'
import { Reproject } from 'utils'

import { Key } from './key'
import { Step } from './step'

export type Bounds = [...Point, ...Point] // Min, max.
const schema: Schema = {
  title: 'Bounds',
  description:
    'Bounding volume of the form [xmin, ymin, zmin, xmax, ymax, zmax]',
  type: 'array',
  items: { type: 'number' },
  minItems: 6,
  maxItems: 6,
}

export const Bounds = {
  schema,
  min,
  max,
  mid,
  width,
  depth,
  height,
  step,
  stepTo,
  reproject,
  offsetHeight,
}

function min(b: Bounds): Point {
  return [b[0], b[1], b[2]]
}
function max(b: Bounds): Point {
  return [b[3], b[4], b[5]]
}
function mid([minx, miny, minz, maxx, maxy, maxz]: Bounds): Point {
  return [
    minx + (maxx - minx) / 2,
    miny + (maxy - miny) / 2,
    minz + (maxz - minz) / 2,
  ]
}

function width(bounds: Bounds) {
  return bounds[3] - bounds[0]
}
function depth(bounds: Bounds) {
  return bounds[4] - bounds[1]
}
function height(bounds: Bounds) {
  return bounds[5] - bounds[2]
}

function step(bounds: Bounds, [a, b, c]: Step): Bounds {
  const [minx, miny, minz, maxx, maxy, maxz] = bounds
  const [midx, midy, midz] = mid(bounds)

  return [
    a ? midx : minx,
    b ? midy : miny,
    c ? midz : minz,
    a ? maxx : midx,
    b ? maxy : midy,
    c ? maxz : midz,
  ]
}

function stepTo(bounds: Bounds, [d, x, y, z]: Key) {
  for (let i = d - 1; i >= 0; --i) {
    bounds = step(bounds, [(x >> i) & 1, (y >> i) & 1, (z >> i) & 1] as Step)
  }
  return bounds
}

function reproject(bounds: Bounds, reproject: Reproject): Bounds {
  return [...reproject(min(bounds)), ...reproject(max(bounds))]
}

function offsetHeight(b: Bounds, zOffset: number): Bounds {
  return [b[0], b[1], b[2] + zOffset, b[3], b[4], b[5] + zOffset]
}
