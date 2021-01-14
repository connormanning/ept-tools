import { DataType, Schema } from 'ept'
import { Rgb } from './rgb'

test('create: no rgb', async () => {
  const schema: Schema = [
    { name: 'X', type: 'float', size: 8 },
    { name: 'Y', type: 'float', size: 8 },
    { name: 'Z', type: 'float', size: 8 },
  ]
  const buffer = Buffer.alloc(Schema.pointSize(schema))
  const view = await DataType.view('binary', buffer, schema)
  const rgb = Rgb.create({ view, options: {} })
  expect(rgb).toHaveLength(0)
})
