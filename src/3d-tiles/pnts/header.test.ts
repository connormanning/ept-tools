import { Header } from './header'

// Valid sizes must all be a multiple of 8.
const buffers = {
  featureTableHeader: Buffer.alloc(8 * 4),
  featureTableBinary: Buffer.alloc(8 * 3 * 24),
  batchTableHeader: Buffer.alloc(8 * 6),
  batchTableBinary: Buffer.alloc(8 * 512),
}
test('invalid buffer sizes', () => {
  const b = Buffer.alloc(7)
  expect(() => Header.create({ ...buffers, featureTableHeader: b })).toThrow(
    /invalid feature table json/i
  )
  expect(() => Header.create({ ...buffers, featureTableBinary: b })).toThrow(
    /invalid feature table binary/i
  )
  expect(() => Header.create({ ...buffers, batchTableHeader: b })).toThrow(
    /invalid batch table json/i
  )
  expect(() => Header.create({ ...buffers, batchTableBinary: b })).toThrow(
    /invalid batch table binary/i
  )
})

test('success', () => {
  const header = Header.create(buffers)

  const magic = header.toString('utf8', 0, 4)
  const version = header.readUInt32LE(4)
  const total = header.readUInt32LE(8)
  const featureTableHeaderSize = header.readUInt32LE(12)
  const featureTableBinarySize = header.readUInt32LE(16)
  const batchTableHeaderSize = header.readUInt32LE(20)
  const batchTableBinarySize = header.readUInt32LE(24)

  expect(magic).toEqual('pnts')
  expect(version).toEqual(1)
  expect(total).toEqual(
    header.length +
      Object.values(buffers).reduce((sum, cur) => sum + cur.length, 0)
  )
  expect(featureTableHeaderSize).toEqual(buffers.featureTableHeader.length)
  expect(featureTableBinarySize).toEqual(buffers.featureTableBinary.length)
  expect(batchTableHeaderSize).toEqual(buffers.batchTableHeader.length)
  expect(batchTableBinarySize).toEqual(buffers.batchTableBinary.length)
})
