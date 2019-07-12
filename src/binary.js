import * as Dimension from './dimension'
import * as Schema from './schema'

const extractors = {
    float: 'readFloatLE',
    double: 'readDoubleLE',
    int8: 'readInt8',
    int16: 'readInt16LE',
    int32: 'readInt32LE',
    int64: 'readInt64LE',
    uint8: 'readUInt8',
    uint16: 'readUInt16LE',
    uint32: 'readUInt32LE',
    uint64: 'readUInt64LE',
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
