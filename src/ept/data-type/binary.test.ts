import { Schema } from '../../ept'

import { Binary } from './binary'

const scale = 0.1
const offset = 100
const schema: Schema = [
  { name: 'i64', type: 'signed', size: 8 },
  { name: 'i32', type: 'signed', size: 4 },
  { name: 'i16', type: 'signed', size: 2 },
  { name: 'i8', type: 'signed', size: 1 },
  { name: 'u64', type: 'unsigned', size: 8 },
  { name: 'u32', type: 'unsigned', size: 4 },
  { name: 'u16', type: 'unsigned', size: 2 },
  { name: 'u8', type: 'unsigned', size: 1 },
  { name: 'f64', type: 'float', size: 8 },
  { name: 'f32', type: 'float', size: 4 },
  { name: 's32', type: 'signed', size: 4, scale, offset },
]
const pointSize = Schema.pointSize(schema)

test('invalid', () => {
  expect(() => Binary.view(Buffer.alloc(pointSize), [])).toThrow(
    /invalid schema point size/i
  )
  expect(() => Binary.view(Buffer.alloc(pointSize - 1), schema)).toThrow(
    /invalid buffer length/i
  )
})

test('get', () => {
  // We'll only write into the second point.
  const buffer = Buffer.alloc(pointSize * 2)

  let value = 42
  buffer.writeBigInt64LE(BigInt(value++), pointSize + 0)
  buffer.writeInt32LE(value++, pointSize + 8)
  buffer.writeInt16LE(value++, pointSize + 12)
  buffer.writeInt8(value++, pointSize + 14)
  buffer.writeBigUInt64LE(BigInt(value++), pointSize + 15 + 0)
  buffer.writeUInt32LE(value++, pointSize + 15 + 8)
  buffer.writeUInt16LE(value++, pointSize + 15 + 12)
  buffer.writeUInt8(value++, pointSize + 15 + 14)
  buffer.writeDoubleLE(value++, pointSize + 15 + 15)
  buffer.writeFloatLE(value++, pointSize + 15 + 15 + 8)
  buffer.writeInt32LE((value - offset) / scale, pointSize + 15 + 15 + 12)

  const view = Binary.view(buffer, schema)
  expect(() => view.getter('bad')(0)).toThrow(/invalid dimension/i)
  expect(() => view.getter('f32')(2)).toThrow(/invalid point index/i)

  value = 42
  expect(view.getter('i64')(1)).toEqual(value++)
  expect(view.getter('i32')(1)).toEqual(value++)
  expect(view.getter('i16')(1)).toEqual(value++)
  expect(view.getter('i8')(1)).toEqual(value++)
  expect(view.getter('u64')(1)).toEqual(value++)
  expect(view.getter('u32')(1)).toEqual(value++)
  expect(view.getter('u16')(1)).toEqual(value++)
  expect(view.getter('u8')(1)).toEqual(value++)
  expect(view.getter('f64')(1)).toEqual(value++)
  expect(view.getter('f32')(1)).toEqual(value++)
  expect(view.getter('s32')(1)).toEqual(value++)
})
