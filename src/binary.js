import * as Dimension from './dimension'
import * as Schema from './schema'

const writers = {
    float: 'writeFloatLE',
    double: 'writeDoubleLE',
    int8: 'writeInt8',
    int16: 'writeInt16LE',
    int32: 'writeInt32LE',
    int64: 'writeBigInt64LE',
    uint8: 'writeUInt8',
    uint16: 'writeUInt16LE',
    uint32: 'writeUInt32LE',
    uint64: 'writeBigUInt64LE',
}

const extractors = {
    float: 'readFloatLE',
    double: 'readDoubleLE',
    int8: 'readInt8',
    int16: 'readInt16LE',
    int32: 'readInt32LE',
    int64: 'readBigInt64LE',
    uint8: 'readUInt8',
    uint16: 'readUInt16LE',
    uint32: 'readUInt32LE',
    uint64: 'readBigUInt64LE',
}

export function getWriter(schema, name) {
    const dimension = Schema.find(schema, name)
    if (!dimension) throw new Error('Cannot get extractor for ' + name)
    const { scale = 1, offset = 0 } = dimension
    const typeString = Dimension.typeString(dimension)
    const writer = writers[typeString]

    const dimOffset = Schema.offset(schema, name)
    const pointSize = Schema.pointSize(schema)

    return (buffer, value, index) => buffer[writer](
        (value - offset) / scale,
        index * pointSize + dimOffset
    )
}

export function getExtractor(schema, name) {
    const dimension = Schema.find(schema, name)
    if (!dimension) throw new Error('Cannot get extractor for ' + name)
    const { scale = 1, offset = 0 } = dimension
    const typeString = Dimension.typeString(dimension)
    const extractor = extractors[typeString]

    const dimOffset = Schema.offset(schema, name)
    const pointSize = Schema.pointSize(schema)

    return (buffer, index) =>
        buffer[extractor](index * pointSize + dimOffset) * scale + offset
}
