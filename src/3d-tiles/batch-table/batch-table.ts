import { Options } from '3d-tiles/types'
import { Dimension, Schema, View } from 'ept'
import { EptToolsError } from 'types'

import { Header } from './header'

// Work around TS namespaced re-export deficiency.
type _Header = Header
export declare namespace BatchTable {
  export type Header = _Header
}
export type BatchTable = { header: Header; binary: Buffer }
export const BatchTable = { create }

function create(
  srcView: View.Readable,
  { dimensions = [] }: Partial<Options> = {}
): BatchTable {
  const { length } = srcView

  const header: Header = {}
  const buffers: Buffer[] = []

  dimensions.forEach((name) => {
    const get = srcView.getter(name)

    const dimension = Schema.find(srcView.schema, name)
    if (!dimension) throw new EptToolsError(`Invalid dimension: ${name}`)
    const outputDimension = getOutputDimension(dimension)

    // Each binary buffer must be padded such that the subsequent buffer meets
    // its alignment requirement.  To make this trivial, just pad everything
    // out to a multiple of 8 bytes.  Note that our ascending byteOffset needs
    // to account for this, so we'll just perform this padding up front.  Also
    // note that since we're not using our padding utility which zero-fills
    // properly, we need to make sure to zero out the pad bytes here: so we're
    // using Buffer.alloc instead of Buffer.allocUnsafe.
    const byteLength = length * outputDimension.size
    const rem = byteLength % 8
    const pad = rem ? 8 - rem : 0
    const buffer = Buffer.alloc(length * outputDimension.size + pad)

    const dstView = View.Writable.create(buffer, [outputDimension])
    const set = dstView.setter(name)

    for (let i = 0; i < length; ++i) {
      set(get(i), i)
    }

    const byteOffset = buffers.reduce((sum, b) => sum + b.length, 0)
    header[name] = {
      byteOffset,
      componentType: getComponentType(outputDimension),
      type: 'SCALAR',
    }

    buffers.push(buffer)
  })

  const binary = Buffer.concat(buffers)
  return { header, binary }
}

function getOutputDimension(dimension: Dimension): Dimension {
  const { name, type, size, scale = 1 } = dimension

  // If the value is scaled, or if it has size 8, then we always use a float.
  // The 64-bit integral types are not allowed.
  if (scale !== 1 || size === 8) return { name, type: 'float', size: 4 }
  return { name, type, size }
}

function getComponentType(dimension: Dimension): Header.ComponentType {
  // We should never see a ctype of (u)int64 here, as it is not allowed as a
  // component type in the batch table.
  const ctype = Dimension.ctype(dimension)
  switch (ctype) {
    case 'int8':
      return 'BYTE'
    case 'int16':
      return 'SHORT'
    case 'int32':
      return 'INT'
    case 'int64':
      throw new EptToolsError('Invalid dimension type')
    case 'uint8':
      return 'UNSIGNED_BYTE'
    case 'uint16':
      return 'UNSIGNED_SHORT'
    case 'uint32':
      return 'UNSIGNED_INT'
    case 'uint64':
      throw new EptToolsError('Invalid dimension type')
    case 'float':
      return 'FLOAT'
    default:
      return 'DOUBLE'
  }
}
