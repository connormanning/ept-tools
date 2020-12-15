import { EptToolsError } from 'types'

import { Dimension } from './dimension'
import { Schema } from './schema'

const x: Dimension = {
  name: 'X',
  type: 'unsigned',
  size: 4,
  scale: 0.01,
  offset: 100,
}
const y: Dimension = { name: 'Y', type: 'float', size: 4 }
const z: Dimension = { name: 'Z', type: 'signed', size: 8 }
const schema: Schema = [x, y, z]

test('find', () => {
  expect(Schema.find(schema, 'X')).toEqual(x)
  expect(Schema.find(schema, 'Y')).toEqual(y)
  expect(Schema.find(schema, 'Z')).toEqual(z)
  expect(Schema.find(schema, 'T')).toBeUndefined()
})

test('has', () => {
  expect(Schema.has(schema, 'X')).toEqual(true)
  expect(Schema.has(schema, 'Y')).toEqual(true)
  expect(Schema.has(schema, 'Z')).toEqual(true)
  expect(Schema.has(schema, 'T')).toEqual(false)
})

test('offset', () => {
  expect(Schema.offset(schema, 'X')).toEqual(0)
  expect(Schema.offset(schema, 'Y')).toEqual(4)
  expect(Schema.offset(schema, 'Z')).toEqual(8)
  expect(() => Schema.offset(schema, 'T')).toThrow(EptToolsError)
})

test('point size', () => {
  expect(Schema.pointSize(schema)).toEqual(16)
})
