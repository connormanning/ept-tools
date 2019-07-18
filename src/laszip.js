import _ from 'lodash'

import Module from './lib/laz-perf.asm'

import * as Binary from './binary'
import * as Schema from './schema'

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

const fixedExtractors = {
    X: p => p.readInt32LE(0),
    Y: p => p.readInt32LE(4),
    Z: p => p.readInt32LE(8),
    Intensity: p => p.readUInt16LE(12)
}

export function getExtractor(name, dataFormatId) {
    if (fixedExtractors[name]) return fixedExtractors[name]

    let extractors = { }
    if (dataFormatId === 2) {
        extractors = {
            Red: p => p.readUInt16LE(20),
            Green: p => p.readUInt16LE(22),
            Blue: p => p.readUInt16LE(24),
        }
    }
    else if (dataFormatId === 3 || dataFormatId === 5) {
        extractors = {
            Red: p => p.readUInt16LE(28),   // 2: 20
            Green: p => p.readUInt16LE(30),
            Blue: p => p.readUInt16LE(32),
        }
    }
    return extractors[name]
}

export async function decompress(compressed, ept) {
    const header = readHeader(compressed)
    const { dataFormatId, points, pointSize, scale, offset } = header

    // TODO: We should try/catch around the code below so we don't leak this
    // in case of an exception - we'll run out of memory quickly otherwise.
    const module = new Module.LASZip()
    const filePointer = Module._malloc(compressed.length)
    Module.HEAPU8.set(compressed, filePointer)
    module.open(filePointer, compressed.byteLength)

    const xyz = ['X', 'Y', 'Z']

    const { schema } = ept
    const schemaScale = xyz.map(name => Schema.find(schema, name).scale || 1)
    const schemaOffset = xyz.map(name => Schema.find(schema, name).offset || 0)
    const absoluteSchema = schema.reduce((schema, dimension) => {
        return schema.concat(
            xyz.includes(dimension.name)
                ? _.omit(dimension, ['scale', 'offset'])
                : dimension
        )
    }, [])

    let dimensions = xyz.slice()
    if (Schema.has(schema, 'Red')) {
        dimensions = dimensions.concat(['Red', 'Green', 'Blue'])
    }
    if (Schema.has(schema, 'Intensity')) {
        dimensions = dimensions.concat('Intensity')
    }

    const readers = dimensions.map((name, i) => {
        if (i < 3) {
            if (
                _.isEqual(scale, schemaScale) &&
                _.isEqual(offset, schemaOffset)
            ) {
                return fixedExtractors[name]
            }

            // If the LAZ scale/offset are different than the schema scale
            // offset, convert them to match the schema.
            return v => {
                const absolute = fixedExtractors[name](v) * scale[i] + offset[i]
                return (absolute - schemaOffset[i]) / scale[i]
            }
        }
        return getExtractor(name, dataFormatId)
    })
    const writers = dimensions
        .map(name => Binary.getWriter(absoluteSchema, name))

    const output = Buffer.allocUnsafe(points * Schema.pointSize(schema))

    const dataPointer = Module._malloc(pointSize)
    const point = Buffer.from(Module.HEAPU8.buffer, dataPointer, pointSize)

    // For now we're only going to read XYZ and RGBI and we'll wastefully leave
    // the other attributes allocated and filled with junk.  For the current
    // context of converting to 3D Tiles, that's just fine.  For more generic
    // library purposes in the future, this may need to change.
    for (var p = 0; p < points; ++p) {
        module.getPoint(dataPointer)
        readers.forEach((read, i) => writers[i](output, read(point), p))
    }
    Module._free(dataPointer)
    Module._free(filePointer)
    module.delete()

    return output
}
