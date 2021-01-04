import * as U from './utils'

test('pad end', () => {
  expect(U.padEnd(Buffer.alloc(0))).toEqual(Buffer.alloc(0))
  expect(U.padEnd(Buffer.alloc(1))).toEqual(Buffer.alloc(8))
  expect(U.padEnd(Buffer.alloc(8))).toEqual(Buffer.alloc(8))

  expect(U.padEnd(Buffer.alloc(4), 0x20)).toEqual(
    Buffer.concat([Buffer.alloc(4), Buffer.alloc(4, 0x20)])
  )
})

test('sum lengths', () => {
  expect(U.sumLengths([])).toEqual(0)
  expect(U.sumLengths([Buffer.alloc(0)])).toEqual(0)
  expect(U.sumLengths([Buffer.alloc(1), Buffer.alloc(2)])).toEqual(3)
})
