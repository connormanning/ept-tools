import { Schema } from '../schema'
import { View } from '../view'

import { Binary } from './binary'

export type DataType = 'binary' | 'laszip' | 'zstandard'
export const DataType = { extension, view }

const extensions = { binary: 'bin', laszip: 'laz', zstandard: 'zst' }
function extension(type: DataType): string {
  return extensions[type]
}

function view(
  dataType: DataType,
  buffer: Buffer,
  schema: Schema
): View.Readable {
  switch (dataType) {
    case 'binary':
      return Binary.view(buffer, schema)
    // TODO: Other types here.
    default:
      throw new Error(`Invalid data type ${dataType}`)
  }
}
