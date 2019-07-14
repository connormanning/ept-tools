import path from 'path'

import * as Constants from '../src/constants'
import * as Cesium from '../src/cesium'

const ellipsoid = path.join(__dirname, 'data/ellipsoid-binary-ecef')

test('binary ecef tileset', async () => {
    const filename = path.join(ellipsoid, 'tileset.json')
    expect(async () => await Cesium.translate(filename)).not.toThrow()
})

test('binary ecef pnts file', async () => {
    const filename = path.join(ellipsoid, '0-0-0-0.pnts')
    const pnts = await Cesium.translate(filename)

    const header = pnts.slice(0, Constants.pntsHeaderSize)
    const points = 100000

    const magic = header.toString('ascii', 0, 4)
    const version = header.readUInt32LE(4)
    const byteLength = header.readUInt32LE(8)
    const featureTableStringSize = header.readUInt32LE(12)
    const featureTableBinarySize = header.readUInt32LE(16)
    const batchTableStringSize = header.readUInt32LE(20)
    const batchTableBinarySize = header.readUInt32LE(24)

    expect(magic).toEqual(Constants.pntsMagic)
    expect(version).toEqual(1)
    expect(featureTableBinarySize).toEqual(
        points * Constants.pntsXyzSize +
        points * Constants.pntsRgbSize
    )
    expect(batchTableStringSize).toEqual(0)
    expect(batchTableBinarySize).toEqual(0)

    expect(byteLength).toEqual(
        Constants.pntsHeaderSize +
        featureTableStringSize +
        featureTableBinarySize
    )

    const featureTableBuffer = pnts.slice(
        Constants.pntsHeaderSize,
        Constants.pntsHeaderSize + featureTableStringSize
    )
    const featureTableMetadata = JSON.parse(featureTableBuffer.toString())
    const xyzOffset = Constants.pntsHeaderSize + featureTableStringSize
    const rgbOffset = xyzOffset + points * Constants.pntsXyzSize
    const xyz = pnts.slice(xyzOffset, rgbOffset)
    const rgb = pnts.slice(rgbOffset)

    // TODO: Do some validation on the point data itself.
})
