import { Step } from './step'

export type Key = [number, number, number, number] // D-X-Y-Z.

export const Key = {
  create: (d = 0, x = 0, y = 0, z = 0): Key => [d, x, y, z],
  parse: (s: string): Key => {
    const [d, x, y, z, ...rest] = s.split('-').map((s) => parseInt(s, 10))
    const key: Key = [d, x, y, z]

    if (
      rest.length !== 0 ||
      key.some((v) => typeof v !== 'number' || Number.isNaN(v))
    ) {
      throw new Error(`Invalid key: ${s}`)
    }

    return key
  },
  stringify: (k: Key) => k.join('-'),
  step: ([d, x, y, z]: Key, [a, b, c]: Step): Key => [
    d + 1,
    x * 2 + a,
    y * 2 + b,
    z * 2 + c,
  ],
  depth: (k: Key) => k[0],
}
