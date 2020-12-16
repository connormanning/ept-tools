import { Bounds, DataType, Schema } from 'ept'
import { Ellipsoid, Pnts } from 'test'
import { Reproject, Scale } from 'utils'

import { Xyz } from './xyz'

test('create', () => {
  const schema: Schema = [
    { name: 'X', type: 'signed', size: 4, scale: 0.01, offset: 100 },
    { name: 'Y', type: 'float', size: 8 },
    { name: 'Z', type: 'signed', size: 4, scale: 0.0025, offset: 500 },
  ]
  const pointSize = Schema.pointSize(schema)
  const buffer = Buffer.alloc(pointSize * 2)

  // In the native SRS of the Ellipsoid: web mercator.
  const tileBounds = Ellipsoid.bounds
  const mid = Bounds.mid(tileBounds)

  // First point: midpoint minus 1 in native coordinate space.
  const a = mid.map((v) => v - 1)
  buffer.writeInt32LE(Scale.apply(a[0], 0.01, 100), 0)
  buffer.writeDoubleLE(a[1], 4)
  buffer.writeInt32LE(Scale.apply(a[2], 0.0025, 500), 12)

  // Second point: midpoint plus 1 in native coordinate space.
  const b = mid.map((v) => v + 1)
  buffer.writeInt32LE(Scale.apply(b[0], 0.01, 100), 16)
  buffer.writeDoubleLE(b[1], 16 + 4)
  buffer.writeInt32LE(Scale.apply(b[2], 0.0025, 500), 16 + 12)

  // Now create our supporting data structures and get our XYZ buffer.
  const view = DataType.view('binary', buffer, schema)

  const toEcef = Reproject.create(Ellipsoid.srsCodeString, 'EPSG:4978')
  const ecefBounds = Bounds.reproject(tileBounds, toEcef)
  const ecefMid = Bounds.mid(ecefBounds)
  const xyz = Xyz.create({
    view,
    tileBounds,
    toEcef,
    options: Pnts.defaultOptions,
  })

  // Should have 2 points.  Each point consists of 3 floats.
  expect(xyz.length).toEqual(4 * 3 * 2)

  const ecefA = toEcef(a)
  expect(xyz.readFloatLE(0)).toBeCloseTo(ecefA[0] - ecefMid[0], 5)
  expect(xyz.readFloatLE(4)).toBeCloseTo(ecefA[1] - ecefMid[1], 5)
  expect(xyz.readFloatLE(8)).toBeCloseTo(ecefA[2] - ecefMid[2], 5)

  const ecefB = toEcef(b)
  expect(xyz.readFloatLE(12)).toBeCloseTo(ecefB[0] - ecefMid[0], 5)
  expect(xyz.readFloatLE(16)).toBeCloseTo(ecefB[1] - ecefMid[1], 5)
  expect(xyz.readFloatLE(20)).toBeCloseTo(ecefB[2] - ecefMid[2], 5)
})
