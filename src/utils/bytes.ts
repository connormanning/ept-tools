import { Ctype } from 'types'

export declare namespace Bytes {
  type Getter = (offset: number) => number
  type Setter = (value: number, offset: number) => void
}

export const Bytes = { getter, setter }

function getter(buffer: Buffer, ctype: Ctype): Bytes.Getter {
  switch (ctype) {
    case 'int8':
      return (offset) => buffer.readInt8(offset)
    case 'int16':
      return (offset) => buffer.readInt16LE(offset)
    case 'int32':
      return (offset) => buffer.readInt32LE(offset)
    case 'int64':
      return (offset) => Number(buffer.readBigInt64LE(offset))
    case 'uint8':
      return (offset) => buffer.readUInt8(offset)
    case 'uint16':
      return (offset) => buffer.readUInt16LE(offset)
    case 'uint32':
      return (offset) => buffer.readUInt32LE(offset)
    case 'uint64':
      return (offset) => Number(buffer.readBigUInt64LE(offset))
    case 'float':
      return (offset) => buffer.readFloatLE(offset)
    case 'double':
      return (offset) => buffer.readDoubleLE(offset)
  }
}

function setter(buffer: Buffer, ctype: Ctype): Bytes.Setter {
  switch (ctype) {
    case 'int8':
      return (value, offset) => buffer.writeInt8(value, offset)
    case 'int16':
      return (value, offset) => buffer.writeInt16LE(value, offset)
    case 'int32':
      return (value, offset) => buffer.writeInt32LE(value, offset)
    case 'int64':
      return (value, offset) => buffer.writeBigInt64LE(BigInt(value), offset)
    case 'uint8':
      return (value, offset) => buffer.writeUInt8(value, offset)
    case 'uint16':
      return (value, offset) => buffer.writeUInt16LE(value, offset)
    case 'uint32':
      return (value, offset) => buffer.writeUInt32LE(value, offset)
    case 'uint64':
      return (value, offset) => buffer.writeBigUInt64LE(BigInt(value), offset)
    case 'float':
      return (value, offset) => buffer.writeFloatLE(value, offset)
    case 'double':
      return (value, offset) => buffer.writeDoubleLE(value, offset)
  }
}
