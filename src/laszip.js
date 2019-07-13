import _ from 'lodash'

import Module from './lib/laz-perf.asm'

import * as Binary from './binary'
import * as Schema from './schema'

const extractors = {
    X: p => p.readInt32LE(0),
    Y: p => p.readInt32LE(4),
    Z: p => p.readInt32LE(8),
    Red: p => p.readUInt16LE(28),
    Green: p => p.readUInt16LE(30),
    Blue: p => p.readUInt16LE(32),
}

const pointOffsetPosition = 32 * 3
const dataFormatIdPosition = pointOffsetPosition + 8
const legacyPointCountPosition = dataFormatIdPosition + 3
const scalePosition = pointOffsetPosition + 35
const offsetPosition = scalePosition + 24
const rangePosition = offsetPosition + 24

function readHeader(buffer) {
    return {
        pointOffset: buffer.readUInt32LE(pointOffsetPosition),
        dataFormatId: buffer.readUInt8(dataFormatIdPosition) & 0x3F,
        pointSize: buffer.readUInt16LE(dataFormatIdPosition + 1),
        points: buffer.readUInt32LE(legacyPointCountPosition),
        scale: [
            buffer.readDoubleLE(scalePosition),
            buffer.readDoubleLE(scalePosition + 8),
            buffer.readDoubleLE(scalePosition + 16),
        ],
        offset: [
            buffer.readDoubleLE(offsetPosition),
            buffer.readDoubleLE(offsetPosition + 8),
            buffer.readDoubleLE(offsetPosition + 16),
        ],
        bounds: [
            buffer.readDoubleLE(rangePosition + 8),
            buffer.readDoubleLE(rangePosition + 8 + 16),
            buffer.readDoubleLE(rangePosition + 8 + 32),
            buffer.readDoubleLE(rangePosition),
            buffer.readDoubleLE(rangePosition + 16),
            buffer.readDoubleLE(rangePosition + 32),
        ],
    }
}

export async function decompress(compressed, ept) {
    const header = readHeader(compressed)
    const { points, pointSize } = header

    const module = new Module.LASZip()
    const filePointer = Module._malloc(compressed.length)
    Module.HEAPU8.set(compressed, filePointer)
    module.open(filePointer, compressed.byteLength)

    // Leave the XYZ in its scaled form when we write to our binary buffer,
    // it will be unscaled properly during extraction.
    const schema = ept.schema.reduce((schema, dimension) => {
        return schema.concat(
            ['X', 'Y', 'Z'].includes(dimension.name)
                ? _.omit(dimension, ['scale', 'offset'])
                : dimension
        )
    }, [])

    const readers = ['X', 'Y', 'Z', 'Red', 'Green', 'Blue']
        .map(name => extractors[name])

    const writers = ['X', 'Y', 'Z', 'Red', 'Green', 'Blue']
        .map(name => Binary.getWriter(schema, name))

    const output = Buffer.alloc(points * Schema.pointSize(schema))

    const dataPointer = Module._malloc(pointSize)
    const point = Buffer.from(Module.HEAPU8.buffer, dataPointer, pointSize)

    // For now we're only going to read XYZ and RGB and we'll wastefully leave
    // the other attributes allocated and zero-filled.
    for (var p = 0 ; p < points; ++p) {
        module.getPoint(dataPointer)
        readers.forEach((read, i) => writers[i](output, read(point), p))
    }
    Module._free(dataPointer)
    Module._free(filePointer)

    return output
}
