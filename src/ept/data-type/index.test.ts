import { DataType } from 'ept'

test('view: invalid type', async () => {
  await expect(() =>
    DataType.view('asdf' as any, Buffer.alloc(0), [])
  ).rejects.toThrow(/invalid data type/i)
})
