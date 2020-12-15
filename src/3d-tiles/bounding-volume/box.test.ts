import { Box } from './box'

test('create', () => {
  const expected = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  expect(Box.create([0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11])).toEqual(
    expected
  )
})
