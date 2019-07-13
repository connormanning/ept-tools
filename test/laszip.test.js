import path from 'path'

import Module from '../src/lib/laz-perf.asm'

import * as Binary from '../src/binary'
import * as Bounds from '../src/bounds'
import * as Laszip from '../src/laszip'
import * as Schema from '../src/schema'
import * as Util from '../src/util'

const base = path.join(__dirname, 'data/ellipsoid-laszip-utm')

test('laszip', async () => {
    const ept = await Util.getJson(path.join(base, 'ept.json'))
    const { schema, bounds, points } = ept

    const root = path.join(base, 'ept-data/0-0-0-0.laz')
    const compressed = await Util.getBuffer(root)
    const buffer = await Laszip.decompress(compressed, ept)

    const pointSize = Schema.pointSize(schema)
    expect(buffer.length / pointSize).toBe(points)

    const extractors = ['X', 'Y', 'Z'].map(v => Binary.getExtractor(schema, v))

    const first = extractors.map(extract => extract(buffer, 0))
    expect(Bounds.mid(bounds)).not.toEqual(first)
    expect(Bounds.contains(bounds, first)).toBe(true)

    const last = extractors.map(extract => extract(buffer, points - 1))
    expect(Bounds.contains(bounds, last)).toBe(true)
})
