import * as Bounds from '../bounds'

test('calculates a midpoint', () => {
    expect(Bounds.mid([0, 0, 0, 2, 4, 6])).toEqual([1, 2, 3])
})

test('bisects bounds properly', () => {
    const b = [0, 0, 0, 8, 8, 8]
    expect(Bounds.step(b, [0, 0, 0])).toEqual([0, 0, 0, 4, 4, 4])
    expect(Bounds.step(b, [0, 0, 1])).toEqual([0, 0, 4, 4, 4, 8])
    expect(Bounds.step(b, [0, 1, 0])).toEqual([0, 4, 0, 4, 8, 4])
    expect(Bounds.step(b, [0, 1, 1])).toEqual([0, 4, 4, 4, 8, 8])
    expect(Bounds.step(b, [1, 0, 0])).toEqual([4, 0, 0, 8, 4, 4])
    expect(Bounds.step(b, [1, 0, 1])).toEqual([4, 0, 4, 8, 4, 8])
    expect(Bounds.step(b, [1, 1, 0])).toEqual([4, 4, 0, 8, 8, 4])
    expect(Bounds.step(b, [1, 1, 1])).toEqual([4, 4, 4, 8, 8, 8])
})

test('no-op bisects to the root key', () => {
    const b = [0, 0, 0, 64, 64, 64]
    const k = [0, 0, 0, 0]
    const max = 64
    expect(Bounds.stepTo(b, k)).toEqual([0, 0, 0, max, max, max])
})

test('bisects to a key the correct number of times', () => {
    const b = [0, 0, 0, 64, 64, 64]
    const k = [2, 0, 0, 0]
    const max = 16
    expect(Bounds.stepTo(b, k)).toEqual([0, 0, 0, max, max, max])
})

test('bisects to a non-trivial key', () => {
    const b = [0, 0, 0, 64, 64, 64]
    const x = [1, 0, 1, 1]
    const y = [2, 1, 2, 3]
    const z = [3, 2, 5, 7]
    expect(Bounds.stepTo(b, x)).toEqual([0, 32, 32, 32, 64, 64])
    expect(Bounds.stepTo(b, y)).toEqual([16, 32, 48, 32, 48, 64])
    expect(Bounds.stepTo(b, z)).toEqual([16, 40, 56, 24, 48, 64])
})

test('converts to 3D-Tiles box format', () => {
    expect(Bounds.boxify([0, 4, 8, 2, 6, 10])).toEqual([
        1, 5, 9,    // Midpoint.
        1, 0, 0,    // X-vector.
        0, 1, 0,    // Y-vector.
        0, 0, 1     // Z-vector.
    ])
})

test('lengths', () => {
    const bounds = [0, 0, 0, 1, 2, 3]
    expect(Bounds.width(bounds)).toEqual(1)
    expect(Bounds.depth(bounds)).toEqual(2)
    expect(Bounds.height(bounds)).toEqual(3)
})
