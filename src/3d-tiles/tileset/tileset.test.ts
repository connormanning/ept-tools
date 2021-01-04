import { BoundingVolume } from '3d-tiles'
import { Bounds, Ept, Hierarchy, Key } from 'ept'
import { Ellipsoid } from 'test'
import { Reproject } from 'utils'

import { Tileset } from './tileset'

test('z offset', () => {
  const key = Key.create()
  const ept: Ept = { ...Ellipsoid.ept, dataType: 'binary' }
  const hierarchy: Hierarchy = { '0-0-0-0': 1, '1-0-0-0': 1 }
  const zOffset = 50
  const options = { zOffset }

  const tileset = Tileset.translate({ key, ept, hierarchy, options })

  const { bounds } = ept
  bounds[2] += zOffset
  bounds[5] += zOffset
  const toWgs84 = Reproject.create(Ellipsoid.srsCodeString, 'EPSG:4326')
  const wgs84 = Bounds.reproject(bounds, toWgs84)
  const region = BoundingVolume.Region.fromWgs84(wgs84)

  const childRegion = BoundingVolume.Region.fromWgs84(
    Bounds.reproject(Bounds.stepTo(bounds, Key.create(1)), toWgs84)
  )

  expect(tileset).toMatchObject({
    root: {
      boundingVolume: { region },
      children: [{ boundingVolume: { region: childRegion } }],
    },
  })
})

test('failure: missing srs', async () => {
  // Remove the SRS from the EPT data.
  const { srs, ...partial } = Ellipsoid.ept
  const ept: Ept = { ...partial, dataType: 'laszip' }
  expect(() =>
    Tileset.translate({
      ept,
      hierarchy: Ellipsoid.rootHierarchy,
      key: Key.create(),
      options: {},
    })
  ).toThrow(/without an srs/i)
})
