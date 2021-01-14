import { JsonSchema } from 'ept'
import { join } from 'protopath'

import { Ellipsoid, testdir } from 'test'
import { getBinary, getJson } from 'utils'

import { Zstandard } from './zstandard'

test('read', async () => {
  const base = join(testdir, 'ellipsoid-zst')
  const { schema } = JsonSchema.parse(await getJson(join(base, 'ept.json')))
  const buffer = await getBinary(join(base, 'ept-data/0-0-0-0.zst'))

  const view = await Zstandard.view(buffer, schema)

  const getx = view.getter('X')
  const gety = view.getter('Y')
  const getz = view.getter('Z')

  for (let i = 0; i < 1; ++i) {
    const x = getx(i)
    const y = gety(i)
    const z = getz(i)
    expect(x).toBeGreaterThanOrEqual(Ellipsoid.boundsConforming[0])
    expect(y).toBeGreaterThanOrEqual(Ellipsoid.boundsConforming[1])
    expect(z).toBeGreaterThanOrEqual(Ellipsoid.boundsConforming[2])
    expect(x).toBeLessThan(Ellipsoid.boundsConforming[3])
    expect(y).toBeLessThan(Ellipsoid.boundsConforming[4])
    expect(z).toBeLessThan(Ellipsoid.boundsConforming[5])
  }
})
