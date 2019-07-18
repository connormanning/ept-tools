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

    return table
}

export function buildFeatureTableString({ ept, options = { }, bounds, points }) {
    return buildFeatureTableMetadata({ ept, options, bounds, points })
        |> JSON.stringify
        |> (v => Util.padRight(v, 8))
}

export function calculateSizes({ ept, options = { }, bounds, points }) {
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

    return {
        headerSize: Constants.pntsHeaderSize,
        featureTableStringSize,
        featureTableBinarySize,
        batchTableStringSize,
        batchTableBinarySize,
        totalSize
    }
}

export function buildHeader({
    output,
    ept,
    options = { },
    bounds,
    points,
    sizes
}) {
    if (output.length != Constants.pntsHeaderSize) {
        throw new Error('Invalid PNTS header buffer size')
    }

    const {
        headerSize,
        featureTableStringSize,
        featureTableBinarySize,
        batchTableStringSize,
        batchTableBinarySize,
        totalSize
    } = sizes

    // https://git.io/fjP8k
    // const output = Buffer.allocUnsafe(Constants.pntsHeaderSize)
    output.write(Constants.pntsMagic, 0, 'ascii')
    output.writeUInt32LE(Constants.pntsVersion, 4)
    output.writeUInt32LE(totalSize, 8)
    output.writeUInt32LE(featureTableStringSize, 12)
    output.writeUInt32LE(featureTableBinarySize, 16)
    output.writeUInt32LE(batchTableStringSize, 20)
    output.writeUInt32LE(batchTableBinarySize, 24)
}

export function buildXyz({
    output,
    ept,
    options,
    bounds: nativeBounds,
    points,
    buffer
}) {
    const { schema, srs } = ept

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
}

export function buildRgbFromIntensity({ output, ept, points, buffer, sizes }) {
    const extract = Binary.getExtractor(ept.schema, 'Intensity')

    let truncate = false
    const intensities = new Array(points)
    for (let point = 0; point < points; ++point) {
        intensities[point] = extract(buffer, point)
        if (intensities[point] > 255) truncate = true
    }

    if (truncate) {
        for (let point = 0; point < points; ++point) {
            intensities[point] >>= 8
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
}

export function buildRgb({ output, ept, points, buffer, sizes, options }) {
    if (options.color === 'intensity') {
        return buildRgbFromIntensity({ output, ept, points, buffer, sizes })
    }

    const extractors = ['Red', 'Green', 'Blue']
        .map(v => Binary.getExtractor(ept.schema, v))

    let truncate = false
    for (let point = 0; !truncate && point < points; ++point) {
        extractors.forEach(extract => {
            if (extract(buffer, point) > 255) truncate = true
        })
    }

    const shift = truncate ? 8 : 0

    let point = 0
    for (let o = 0; o < output.length; o += Constants.pntsRgbSize) {
        extractors.forEach((extract, i) => {
            output.writeUInt8(extract(buffer, point) >> shift, o + i)
        })
        ++point
    }
}

export function buildFeatureTable({
    output,
    ept,
    bounds,
    points,
    buffer,
    sizes,
    options = { },
}) {
    buildXyz({
        output: output.slice(0, points * Constants.pntsXyzSize),
        ept,
        points,
        bounds,
        buffer,
        sizes,
        options
    })

    if (options.color) {
        buildRgb({
            output: output.slice(
                points * Constants.pntsXyzSize,
                points * Constants.pntsXyzSize + points * Constants.pntsRgbSize
            ),
            ept,
            points,
            bounds,
            buffer,
            sizes,
            options
        })
    }
}

export function translate({ ept, bounds, points, buffer, options = { } }) {
    const sizes = calculateSizes({ ept, options, bounds, points })
    const output = Buffer.allocUnsafe(sizes.totalSize)

    const { headerSize, featureTableStringSize, featureTableBinarySize } = sizes

    const header = output.slice(0, headerSize)
    const featureTable = output.slice(
        headerSize + featureTableStringSize,
        headerSize + featureTableStringSize + featureTableBinarySize
    )

    buildHeader({
        output: header,
        ept,
        options,
        bounds,
        points,
        sizes
    })

    const featureTableString =
        buildFeatureTableString({ ept, options, bounds, points })

    output.write(
        featureTableString,
        headerSize,
        featureTableString.length,
        'ascii'
    )

    buildFeatureTable({
        output: featureTable,
        ept,
        options,
        bounds,
        points,
        buffer,
        sizes
    })

    return output
}
