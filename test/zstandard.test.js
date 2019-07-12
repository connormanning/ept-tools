import path from 'path'
import util from 'util'

import { ZstdCodec } from 'zstd-codec'

import * as Binary from '../src/binary'
import * as Bounds from '../src/bounds'
import * as Schema from '../src/schema'
import * as Util from '../src/util'
import * as Zstandard from '../src/zstandard'

test('can be decompressed', async () => {
    const ept = await Util.getJson(
        path.join(__dirname, '/data/ellipsoid-zstandard-utm/ept.json')
    )

    const root = path.join(
        __dirname,
        '/data/ellipsoid-zstandard-utm/ept-data/0-0-0-0.zst'
    )
    const buffer = await Zstandard.decompress(await Util.getBuffer(root))
    expect(buffer).toBeInstanceOf(Buffer)

    const { schema, bounds, points } = ept
    const pointSize = Schema.pointSize(schema)
    expect(buffer.length / pointSize).toBe(points)

    const extractors = ['X', 'Y', 'Z'].map(v => Binary.getExtractor(schema, v))

    const first = extractors.map(extract => extract(buffer, 0))
    expect(Bounds.contains(bounds, first))

    const last = extractors.map(extract => extract(buffer, points - 1))
    expect(Bounds.contains(bounds, last))
})
