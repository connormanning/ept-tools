import { Point } from './point'

export type Box = [...Point, ...Point, ...Point, ...Point]
export const Box = {
  create: (center: Point, xAxis: Point, yAxis: Point, zAxis: Point): Box => [
    ...center,
    ...xAxis,
    ...yAxis,
    ...zAxis,
  ],
}
