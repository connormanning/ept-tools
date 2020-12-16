import { DataType } from '.'

test('view: invalid type', () => {
  expect(() => DataType.view('asdf' as any, Buffer.alloc(0), [])).toThrow(
    /invalid data type/i
  )
})
