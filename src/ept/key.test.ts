import { Key } from './key'


test('parse', () => {
  const message = /invalid key/i
  expect(() => Key.parse('0-0-0')).toThrow(message)
  expect(() => Key.parse('0-0-0-0-0')).toThrow(message)
  expect(() => Key.parse('0-a-0-0')).toThrow(message)

  expect(Key.parse('0-0-0-0')).toEqual([0,0,0,0])
  expect(Key.parse('8-16-128-1')).toEqual([8, 16, 128, 1])
})
