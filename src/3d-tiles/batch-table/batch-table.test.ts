import { DataType, Schema } from 'ept'
import { Dummy } from 'test'

import { BatchTable } from '.'

test('create: empty', () => {
  const schema = Dummy.Schema.xyz
  const buffer = Buffer.alloc(Schema.pointSize(schema))
  const view = DataType.view('binary', buffer, schema)

  const { header, binary } = BatchTable.create(view)
  expect(header).toEqual({})
  expect(binary).toHaveLength(0)
})