import { Header } from './header'

// Valid sizes must all be a multiple of 8.
const sizes = {
  featureTableJson: 8 * 4,
  featureTableBinary: 8 * 3 * 24,
  batchTableJson: 8 * 6,
  batchTableBinary: 8 * 512,
}
test('invalid buffer sizes', () => {
  expect(() => Header.create({ ...sizes, featureTableJson: 7 })).toThrow(
    /invalid feature table json/i
  )
  expect(() => Header.create({ ...sizes, featureTableBinary: 7 })).toThrow(
    /invalid feature table binary/i
  )
  expect(() => Header.create({ ...sizes, batchTableJson: 7 })).toThrow(
    /invalid batch table json/i
  )
  expect(() => Header.create({ ...sizes, batchTableBinary: 7 })).toThrow(
    /invalid batch table binary/i
  )
})

test('success', () => {
  const header = Header.create(sizes)

  const magic = header.toString('utf8', 0, 4)
  const version = header.readUInt32LE(4)
  const total = header.readUInt32LE(8)
  const featureTableJsonSize = header.readUInt32LE(12)
  const featureTableBinarySize = header.readUInt32LE(16)
  const batchTableJsonSize = header.readUInt32LE(20)
  const batchTableBinarySize = header.readUInt32LE(24)

  expect(magic).toEqual('pnts')
  expect(version).toEqual(1)
  expect(total).toEqual(
    header.length + Object.values(sizes).reduce((sum, cur) => sum + cur)
  )
  expect(featureTableJsonSize).toEqual(sizes.featureTableJson)
  expect(featureTableBinarySize).toEqual(sizes.featureTableBinary)
  expect(batchTableJsonSize).toEqual(sizes.batchTableJson)
  expect(batchTableBinarySize).toEqual(sizes.batchTableBinary)
})
