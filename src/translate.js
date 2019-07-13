import path from 'path'

import * as Bounds from './bounds'
import * as Key from './key'
import * as Laszip from './laszip'
import * as Pnts from './pnts'
import * as Schema from './schema'
import * as Srs from './srs'
import * as Tile from './tile'
import * as Util from './util'
import * as Zstandard from './zstandard'

export async function translate(filename) {
    const eptRoot = Util.dirname(filename)
    const tilename = Util.basename(filename)
    const [root, extension] = tilename.split('.')

    const ept = await Util.getJson(path.join(eptRoot, 'ept.json'))
    const { bounds: eptBounds, schema, dataType, srs } = ept

    if (!Srs.codeString(srs)) {
        throw new Error('EPT SRS code is required for conversion')
    }

    const dataExtension = {
        binary: 'bin',
        laszip: 'laz',
        zstandard: 'zst',
    }[dataType]

    if (!dataExtension) {
        throw new Error(`EPT data type ${dataType} is not supported`)
    }

    if (root === 'tileset') {
        if (extension !== 'json') {
            throw new Error('Invalid filename: ' + filename)
        }

        const key = Key.create()
        const hierarchy = await Util.getJson(
            path.join(eptRoot, 'ept-hierarchy', Key.stringify(key) + '.json')
        )
        return Tile.translate({ key, ept, hierarchy })
    }

    const key = Key.create(...root.split('-').map(v => parseInt(v, 10)))

    if (extension === 'json') {
        const hierarchy = await Util.getJson(
            path.join(eptRoot, 'ept-hierarchy', Key.stringify(key) + '.json')
        )
        return Tile.translate({ key, ept, hierarchy })
    }
    else if (extension === 'pnts') {
        let buffer = await Util.getBuffer(
            path.join(
                eptRoot,
                'ept-data',
                Key.stringify(key) + `.${dataExtension}`
            )
        )

        if (dataType === 'zstandard') {
            buffer = await Zstandard.decompress(buffer)
        }
        else if (dataType === 'laszip') {
            buffer = await Laszip.decompress(buffer, ept)
        }

        const options = {
            color: Schema.has(schema, 'Red'),
            // TODO: Normals are not yet supported.
            normals: false // Schema.has(schema, 'NormalX')
        }

        const points = buffer.length / Schema.pointSize(schema)
        const bounds = Bounds.stepTo(eptBounds, key)
        return Pnts.translate({ ept, options, bounds, points, buffer })
    }
}
