import { Dimension, Schema } from '../../ept'
import { Ctype, EptToolsError, View } from '../../types'
import { Scale } from '../../utils'

export const type = 'binary'
export const extension = 'bin'

export const Binary = { view }

// Similar in spirit to View.Getter, but this Extractor operates on a byte
// offset rather than a point index.
type Extractor = (offset: number) => number
function createExtractor(buffer: Buffer, ctype: Ctype): Extractor {
  return (offset) => {
    switch (ctype) {
      case 'int8':
        return buffer.readInt8(offset)
      case 'int16':
        return buffer.readInt16LE(offset)
      case 'int32':
        return buffer.readInt32LE(offset)
      case 'int64':
        return Number(buffer.readBigInt64LE(offset))
      case 'uint8':
        return buffer.readUInt8(offset)
      case 'uint16':
        return buffer.readUInt16LE(offset)
      case 'uint32':
        return buffer.readUInt32LE(offset)
      case 'uint64':
        return Number(buffer.readBigUInt64LE(offset))
      case 'float':
        return buffer.readFloatLE(offset)
      case 'double':
        return buffer.readDoubleLE(offset)
    }
  }
}

function view(buffer: Buffer, schema: Schema): View {
  const pointSize = Schema.pointSize(schema)

  if (pointSize === 0) {
    throw new EptToolsError(`Invalid schema point size: ${pointSize}`)
  }

  const length = buffer.length / pointSize
  if (buffer.length % pointSize !== 0) {
    throw new EptToolsError('Invalid buffer length for this schema')
  }

  const map = schema.reduce<View.Getters>((map, dim) => {
    const { scale = 1, offset = 0 } = dim
    const ctype = Dimension.ctype(dim)
    const extractor = createExtractor(buffer, ctype)
    const dimOffset = Schema.offset(schema, dim.name)

    map[dim.name] = (index: number) => {
      if (index >= length) {
        throw new EptToolsError(`Invalid point index: ${index} >= ${length}`)
      }
      return Scale.unapply(
        extractor(index * pointSize + dimOffset),
        scale,
        offset
      )
    }
    return map
  }, {})

  const has = (name: string) => Boolean(map[name])
  const getter = (name: string) => {
    const get = map[name]
    if (!get) throw new EptToolsError(`Invalid dimension: ${name}`)
    return get
  }

  return { has, getter, length }
}
