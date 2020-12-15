import { Sphere } from './sphere'

test('create', () => {
  expect(Sphere.create([0, 1, 2], 3)).toEqual([0, 1, 2, 3])
})
