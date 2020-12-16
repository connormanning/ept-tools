import { Dimension } from '.'

test('ctype: invalid dimension', () => {
  expect(() =>
    Dimension.ctype({ name: 'A', type: 'asdf' as any, size: 4 })
  ).toThrow(/invalid dimension/i)

  expect(() => Dimension.ctype({ name: 'A', type: 'float', size: 2 })).toThrow(
    /invalid dimension/i
  )
})
