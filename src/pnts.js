import _ from 'lodash'

import * as Binary from './binary'
import * as Bounds from './bounds'
import * as Constants from './constants'
import * as Proj from './proj'
import * as Schema from './schema'
import * as Srs from './srs'
import * as Util from './util'

export function buildFeatureTableMetadata({
    ept,
    options = { },
    bounds: nativeBounds,
    points
}) {
    const srsCodeString = Srs.codeString(ept.srs)
    const toEcef = Proj.ecefConverter(srsCodeString)

    const bounds = toEcef(Bounds.min(nativeBounds))
        .concat(toEcef(Bounds.max(nativeBounds)))

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

export function buildFeatureTableString({ ept, options = { }, bounds, points }) {
    return buildFeatureTableMetadata({ ept, options, bounds, points })
        |> JSON.stringify
        |> (v => Util.padRight(v, 8))
}

export function buildHeader({ ept, options = { }, bounds, points }) {
    const featureTableString =
        buildFeatureTableString({ ept, options, bounds,  points })

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
    const output = Buffer.allocUnsafe(Constants.pntsHeaderSize)
    output.write(Constants.pntsMagic, 0, 'ascii')
    output.writeUInt32LE(Constants.pntsVersion, 4)
    output.writeUInt32LE(totalSize, 8)
    output.writeUInt32LE(featureTableStringSize, 12)
    output.writeUInt32LE(featureTableBinarySize, 16)
    output.writeUInt32LE(batchTableStringSize, 20)
    output.writeUInt32LE(batchTableBinarySize, 24)
    return output
}

export function buildXyz({ ept, options, bounds: nativeBounds, points, buffer }) {
    const { schema, srs } = ept

    const output = Buffer.allocUnsafe(points * Constants.pntsXyzSize)
    const extractors = ['X', 'Y', 'Z'].map(v => Binary.getExtractor(schema, v))

    const srsCodeString = Srs.codeString(srs)
    const toEcef = Proj.ecefConverter(srsCodeString)

    const bounds = toEcef(Bounds.min(nativeBounds))
        .concat(toEcef(Bounds.max(nativeBounds)))
    const mid = Bounds.mid(bounds)

    let point = 0
    for (let o = 0; o < output.length; o += Constants.pntsXyzSize) {
        toEcef(extractors.map(v => v(buffer, point)))
            .forEach((v, i) => output.writeFloatLE(v - mid[i], o + i * 4))
        ++point
    }
    return output
}

export function buildRgbFromIntensity({ ept, points, buffer }) {
    const output = Buffer.allocUnsafe(points * Constants.pntsRgbSize)
    const extract = Binary.getExtractor(ept.schema, 'Intensity')

    let truncate = false
    const intensities = new Array(points)
    for (let point = 0; point < points; ++point) {
        intensities[point] = extract(buffer, point)
        if (intensities[point] > 255) truncate = true
    }


    if (truncate) {
        for (let point = 0; point < points; ++point) {
            if (intensities[point] > 255) intensities[point] = 255
        }
    }

    let point = 0
    let intensity = 0
    for (let o = 0; o < output.length; o += Constants.pntsRgbSize) {
        intensity = intensities[point]
        output.writeUInt8(intensity, o)
        output.writeUInt8(intensity, o + 1)
        output.writeUInt8(intensity, o + 2)
        ++point
    }
    return output
}

export function buildRgb({ ept, options, points, buffer }) {
    if (options.color === 'intensity') {
        return buildRgbFromIntensity({ ept, points, buffer})
    }

    const output = Buffer.allocUnsafe(points * Constants.pntsRgbSize)
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
            buildRgb({ ept, options, points, buffer })
        ])
    }

    return featureTable
}

export function translate({ ept, options = { }, bounds, points, buffer }) {
    // TODO: Would be easy to pre-calculate the total size, allocate a single
    // Buffer, and shallowly `slice` it into these builder functions to avoid
    // multiple allocations.
    const header = buildHeader({ ept, options, bounds, points })
    const featureTableMetadata = Buffer.from(
        buildFeatureTableString({ ept, options, bounds, points }),
        'ascii'
    )
    const featureTable =
        buildFeatureTable({ ept, options, bounds, points, buffer })

    return Buffer.concat([header, featureTableMetadata, featureTable])
}
