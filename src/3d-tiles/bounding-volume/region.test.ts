import { Region } from './region'

test('from wgs84', () => {
  const west = -90
  const east = 45
  const south = -45
  const north = 30
  const minz = -5
  const maxz = 42

  expect(Region.fromWgs84([west, south, minz, east, north, maxz])).toEqual([
    (west * Math.PI) / 180,
    (south * Math.PI) / 180,
    (east * Math.PI) / 180,
    (north * Math.PI) / 180,
    minz,
    maxz,
  ])
})
