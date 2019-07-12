export function typeString(dimension) {
    const { type, size } = dimension
    if (type == 'float') {
        if (size == 4) return 'float'
        if (size == 8) return 'double'
    }
    if (type == 'signed') {
        if (size == 1) return 'int8'
        if (size == 2) return 'int16'
        if (size == 4) return 'int32'
        if (size == 8) return 'int64'
    }
    if (type == 'unsigned') {
        if (size == 1) return 'uint8'
        if (size == 2) return 'uint16'
        if (size == 4) return 'uint32'
        if (size == 8) return 'uint64'
    }
    throw new Error('Invalid dimension type/size')
}
