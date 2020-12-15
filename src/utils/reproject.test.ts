import { Reproject } from '.'

const point3857 = [-8242596, 4966606]
const point4326 = [-74.0444996762243, 40.68919824733844]

test('create: implicit 4326', () => {
  const reproject = Reproject.create('EPSG:3857')
  expect(reproject(point3857)).toEqual(point4326)
  expect(reproject([...point3857, 42])).toEqual([...point4326, 42])
})

test('create: explicit 4326', () => {
  const reproject = Reproject.create('EPSG:3857', 'EPSG:4326')
  expect(reproject(point3857)).toEqual(point4326)
  expect(reproject([...point3857, 42])).toEqual([...point4326, 42])
})
