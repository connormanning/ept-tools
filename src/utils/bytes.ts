import { Ctype } from 'types'

export declare namespace Bytes {
  type Getter = (offset: number) => number
}

export const Bytes = {
  Getter: { create: createGetter },
}

function createGetter(buffer: Buffer, ctype: Ctype): Bytes.Getter {
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
