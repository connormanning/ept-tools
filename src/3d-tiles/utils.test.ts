import * as U from './utils'

test('pad end', () => {
  expect(U.padEnd(Buffer.alloc(0))).toEqual(Buffer.alloc(0))
  expect(U.padEnd(Buffer.alloc(1))).toEqual(Buffer.alloc(8))
  expect(U.padEnd(Buffer.alloc(8))).toEqual(Buffer.alloc(8))

  expect(U.padEnd(Buffer.alloc(4), 0x20)).toEqual(
    Buffer.concat([Buffer.alloc(4), Buffer.alloc(4, 0x20)])
  )
})
