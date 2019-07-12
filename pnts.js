import _ from 'lodash'

import * as Binary from './binary'
import * as Bounds from './bounds'
import * as Constants from './constants'
import * as Schema from './schema'
import * as Util from './util'

export function buildFeatureTableMetadata({ options = { }, bounds, points }) {
    const table = {
        RTC_CENTER: Bounds.mid(bounds),
        POINTS_LENGTH: points,
        POSITION: { byteOffset: 0 }
    }
    let byteOffset = points * Constants.pntsXyzSize

    if (options.color) {
        _.assign(table, { RGB: { byteOffset } })
        byteOffset += points * Constants.pntsRgbSize
    }

    /*
    if (options.normals) {
        _.assign(table, { NORMAL: { byteOffset } })
    }
    */

    return table
}

export function buildFeatureTableString({ options = { }, bounds, points }) {
    return buildFeatureTableMetadata({ options, bounds, points })
        |> JSON.stringify
        |> (v => Util.padRight(v, 8))
}

export function buildHeader({ options = { }, bounds, points }) {
    const featureTableString =
        buildFeatureTableString({ options, bounds,  points })

    const featureTableStringSize = featureTableString.length
    const featureTableBinarySize = (
        points * Constants.pntsXyzSize +
        (options.color ? points * Constants.pntsRgbSize : 0)
    )
    const batchTableStringSize = 0
    const batchTableBinarySize = 0
    const totalSize = (
        Constants.pntsHeaderSize +
        featureTableStringSize +
        featureTableBinarySize +
        batchTableStringSize +
        batchTableBinarySize
    )

    // https://git.io/fjP8k
    const output = Buffer.alloc(Constants.pntsHeaderSize)
    output.write(Constants.pntsMagic, 0, 'ascii')
    output.writeUInt32LE(Constants.pntsVersion, 4)
    output.writeUInt32LE(totalSize, 8)
    output.writeUInt32LE(featureTableStringSize, 12)
    output.writeUInt32LE(featureTableBinarySize, 16)
    output.writeUInt32LE(batchTableStringSize, 20)
    output.writeUInt32LE(batchTableBinarySize, 24)
    return output
}

export function buildXyz({ ept, bounds, points, buffer }) {
    const output = Buffer.alloc(points * Constants.pntsXyzSize)
    const extractors = ['X', 'Y', 'Z']
        .map(v => Binary.getExtractor(ept.schema, v))
    const mid = Bounds.mid(bounds)

    let point = 0
    for (let o = 0; o < output.length; o += Constants.pntsXyzSize) {
        extractors.forEach((extract, i) => {
            output.writeFloatLE(
                extract(buffer, point) - mid[i],
                o + i * 4
            )
        })
        ++point
    }
    return output
}

export function buildRgb({ ept, points, buffer }) {
    const output = Buffer.alloc(points * Constants.pntsRgbSize)
    const extractors = ['Red', 'Green', 'Blue']
        .map(v => Binary.getExtractor(ept.schema, v))
    let point = 0
    for (let o = 0; o < output.length; o += Constants.pntsRgbSize) {
        extractors.forEach((extract, i) => {
            output.writeUInt8(extract(buffer, point), o + i)
        })
        ++point
    }
    return output
}

export function buildFeatureTable({ ept, options, bounds, points, buffer }) {
    let featureTable = buildXyz({ ept, points, bounds, buffer })

    if (options.color) {
        featureTable = Buffer.concat([
            featureTable,
            buildRgb({ ept, points, buffer })
        ])
    }

    return featureTable
}

export function translate({ ept, options = { }, bounds, points, buffer }) {
    // TODO: Would be easy to pre-calculate the total size, allocate a single
    // Buffer, and shallowly `slice` it into these builder functions to avoid
    // multiple allocations.
    const header = buildHeader({ options, bounds, points })
    const featureTableMetadata = Buffer.from(
        buildFeatureTableString({ options, bounds, points }),
        'ascii'
    )
    const featureTable =
        buildFeatureTable({ ept, options, bounds, points, buffer })

    return Buffer.concat([header, featureTableMetadata, featureTable])
}
