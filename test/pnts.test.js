import * as Bounds from '../bounds'
import * as Constants from '../constants'
import * as Pnts from '../pnts'
import * as Schema from '../schema'
import * as Util from '../util'
import { fdatasyncSync } from 'fs';

test('feature table metadata', () => {
    const ept = { schema: [] }
    const points = 42
    const bounds = [0, 0, 0, 10, 10, 10]
    expect(Pnts.buildFeatureTableMetadata({ ept, bounds, points })).toEqual({
        RTC_CENTER: [5, 5, 5],
        POINTS_LENGTH: points,
        POSITION: { byteOffset: 0 }
    })
    fdatasyncSync
})

test('basic header', () => {
    const ept = { schema: [] }
    const points = 42
    const bounds = [0, 0, 0, 10, 10, 10]
    const header = Pnts.buildHeader({ ept, bounds, points })
    const featureTableString =
        Pnts.buildFeatureTableMetadata({ ept, bounds, points })
        |> JSON.stringify
        |> (v => Util.padRight(v, 8))

    expect(header).toBeInstanceOf(Buffer)
    expect(header.length).toEqual(Constants.pntsHeaderSize)

    const magic = header.toString('ascii', 0, 4)
    const version = header.readUInt32LE(4)
    const byteLength = header.readUInt32LE(8)
    const featureTableJSONByteLength = header.readUInt32LE(12)
    const featureTableBinaryByteLength = header.readUInt32LE(16)
    const batchTableJSONByteLength = header.readUInt32LE(20)
    const batchTableBinaryByteLength = header.readUInt32LE(24)

    expect(magic).toEqual(Constants.pntsMagic)
    expect(version).toEqual(Constants.pntsVersion)
    expect(byteLength).toEqual(
        Constants.pntsHeaderSize +
        featureTableString.length +
        points * Constants.pntsXyzSize
    )
    expect(featureTableJSONByteLength).toEqual(featureTableString.length)
    expect(featureTableBinaryByteLength).toEqual(points * Constants.pntsXyzSize)
    expect(batchTableJSONByteLength).toEqual(0)
    expect(batchTableBinaryByteLength).toEqual(0)
})

test('header with color', () => {
    const ept = {
        schema: [
            { name: 'X', type: 'float', size: 8 },
            { name: 'Y', type: 'float', size: 8 },
            { name: 'Z', type: 'float', size: 8 },
            { name: 'Red', type: 'unsigned', size: 1 },
            { name: 'Green', type: 'unsigned', size: 1 },
            { name: 'Blue', type: 'unsigned', size: 1 },
        ]
    }
    const options = { color: true }
    const points = 42
    const bounds = [0, 0, 0, 10, 10, 10]
    const header = Pnts.buildHeader({ ept, options, bounds, points })
    const featureTableString = Pnts.buildFeatureTableMetadata(
        { ept, options, bounds, points }
    )
        |> JSON.stringify
        |> (v => Util.padRight(v, 8))

    expect(header).toBeInstanceOf(Buffer)
    expect(header.length).toEqual(Constants.pntsHeaderSize)

    const magic = header.toString('ascii', 0, 4)
    const version = header.readUInt32LE(4)
    const byteLength = header.readUInt32LE(8)
    const featureTableJSONByteLength = header.readUInt32LE(12)
    const featureTableBinaryByteLength = header.readUInt32LE(16)
    const batchTableJSONByteLength = header.readUInt32LE(20)
    const batchTableBinaryByteLength = header.readUInt32LE(24)

    expect(magic).toEqual(Constants.pntsMagic)
    expect(version).toEqual(Constants.pntsVersion)
    expect(byteLength).toEqual(
        Constants.pntsHeaderSize +
        featureTableString.length +
        points * Constants.pntsXyzSize +
        points * Constants.pntsRgbSize
    )
    expect(featureTableJSONByteLength).toEqual(featureTableString.length)
    expect(featureTableBinaryByteLength).toEqual(
        points * Constants.pntsXyzSize +
        points * Constants.pntsRgbSize
    )
    expect(batchTableJSONByteLength).toEqual(0)
    expect(batchTableBinaryByteLength).toEqual(0)
})

test('basic feature table', () => {
    const ept = {
        schema: [
            { name: 'X', type: 'float', size: 8 },
            { name: 'Y', type: 'float', size: 8 },
            { name: 'Z', type: 'float', size: 8 }
        ]
    }
    const pointSize = Schema.pointSize(ept.schema)
    const options = { color: false }
    const points = 42

    const bounds = [100, 200, 300, 400, 500, 600]
    const mid = Bounds.mid(bounds)

    const buffer = Buffer.alloc(points * pointSize)
    let point = 0
    for (let o = 0; o < buffer.length; o += pointSize) {
        buffer.writeDoubleLE(100 + point, o)
        buffer.writeDoubleLE(200 + point, o + 8)
        buffer.writeDoubleLE(300 + point, o + 16)
        ++point
    }

    const featureTable =
        Pnts.buildFeatureTable({ ept, options, bounds, points, buffer })

    expect(featureTable).toBeInstanceOf(Buffer)
    expect(featureTable.length).toEqual(points * Constants.pntsXyzSize)

    point = 0
    for (let o = 0; o < featureTable.length; o += Constants.pntsXyzSize) {
        expect(featureTable.readFloatLE(o) + mid[0]).toEqual(100 + point)
        expect(featureTable.readFloatLE(o + 4) + mid[1]).toEqual(200 + point)
        expect(featureTable.readFloatLE(o + 8) + mid[2]).toEqual(300 + point)
        ++point
    }
})

test('feature table with color', () => {
    const ept = {
        schema: [
            { name: 'X', type: 'float', size: 8 },
            { name: 'Y', type: 'float', size: 8 },
            { name: 'Z', type: 'float', size: 8 },
            { name: 'Red', type: 'unsigned', size: 1 },
            { name: 'Green', type: 'unsigned', size: 1 },
            { name: 'Blue', type: 'unsigned', size: 1 },
        ]
    }
    const pointSize = Schema.pointSize(ept.schema)
    const options = { color: true }
    const points = 42

    const bounds = [100, 200, 300, 400, 500, 600]
    const mid = Bounds.mid(bounds)

    const buffer = Buffer.alloc(points * pointSize)
    let point = 0
    for (let o = 0; o < buffer.length; o += pointSize) {
        buffer.writeDoubleLE(100 + point, o)
        buffer.writeDoubleLE(200 + point, o + 8)
        buffer.writeDoubleLE(300 + point, o + 16)
        buffer.writeUInt8(10 + point, o + 24)
        buffer.writeUInt8(20 + point, o + 25)
        buffer.writeUInt8(30 + point, o + 26)
        ++point
    }

    const featureTable =
        Pnts.buildFeatureTable({ ept, options, bounds, points, buffer })

    expect(featureTable).toBeInstanceOf(Buffer)
    const xyzSize = points * Constants.pntsXyzSize
    const rgbSize = points * Constants.pntsRgbSize
    expect(featureTable.length).toEqual(xyzSize + rgbSize)

    for (let i = 0; i < points; ++i) {
        const offset = i * Constants.pntsXyzSize
        expect(featureTable.readFloatLE(offset) + mid[0]).toEqual(100 + i)
        expect(featureTable.readFloatLE(offset + 4) + mid[1]).toEqual(200 + i)
        expect(featureTable.readFloatLE(offset + 8) + mid[2]).toEqual(300 + i)
    }

    for (let i = 0; i < points; ++i) {
        const offset = xyzSize + i * Constants.pntsRgbSize
        expect(featureTable.readUInt8(offset)).toEqual(10 + i)
        expect(featureTable.readUInt8(offset + 1)).toEqual(20 + i)
        expect(featureTable.readUInt8(offset + 2)).toEqual(30 + i)
    }
})
