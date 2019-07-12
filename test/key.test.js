import * as Key from '../src/key'

test('sanely constructs keys', () => {
    expect(Key.create()).toEqual([0, 0, 0, 0])
    expect(Key.create(1)).toEqual([1, 0, 0, 0])
    expect(Key.create(0, 0, 0, 0)).toEqual([0, 0, 0, 0])
    expect(Key.create(1, 1, 1, 1)).toEqual([1, 1, 1, 1])
})

test('steps properly', () => {
    const key = Key.create()

    expect(Key.step(Key.create(), [0, 0, 0]))
    .toEqual([1, 0, 0, 0])

    expect(Key.step([1, 1, 1, 1], [1, 1, 1]))
    .toEqual([2, 3, 3, 3])
})

test('stringifies to a dash-separated key', () => {
    expect(Key.stringify(Key.create())).toEqual('0-0-0-0')
    expect(Key.stringify([0, 0, 0, 0])).toEqual('0-0-0-0')
    expect(Key.stringify([1, 0, 0, 0])).toEqual('1-0-0-0')
    expect(Key.stringify([1, 1, 1, 1])).toEqual('1-1-1-1')
})
