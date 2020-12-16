import { DataType, Schema } from 'ept'
import { Rgb } from './rgb'

test('create: no rgb', () => {
  const schema: Schema = [
    { name: 'X', type: 'float', size: 8 },
    { name: 'Y', type: 'float', size: 8 },
    { name: 'Z', type: 'float', size: 8 },
  ]
  const buffer = Buffer.alloc(Schema.pointSize(schema))
  const view = DataType.view('binary', buffer, schema)
  const rgb = Rgb.create({ view })
  expect(rgb).toHaveLength(0)
})
