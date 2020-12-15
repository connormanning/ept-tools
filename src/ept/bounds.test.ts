import { Bounds } from './bounds'

test('extractions', () => {
  const b: Bounds = [0, 1, 2, 6, 7, 8]
  expect(Bounds.min(b)).toEqual([0, 1, 2])
  expect(Bounds.max(b)).toEqual([6, 7, 8])
  expect(Bounds.mid(b)).toEqual([3, 4, 5])
})

test('measures', () => {
  const b: Bounds = [0, 0, 0, 1, 2, 3]
  expect(Bounds.width(b)).toEqual(1)
  expect(Bounds.depth(b)).toEqual(2)
  expect(Bounds.height(b)).toEqual(3)
})
