import Module from 'lib/laz-perf'

import { Schema } from 'ept'

import { View } from '../../view'

import * as Format from './format'
import { Header } from './header'

export type type = 'laszip'
export const extension = 'laz'

export const Laszip = { view }

let isReady = false

Module.onRuntimeInitialized = () => isReady = true

async function view(input: Buffer): Promise<View.Readable> {
  const header = Header.parse(input)
  const { pointCount } = header

  while (!isReady) await new Promise(resolve => setTimeout(resolve, 10))

  const laszip = new Module.LASZip()
  const filePointer = Module._malloc(input.length)
  const dataPointer = Module._malloc(header.pointSize)

  try {
    Module.HEAPU8.set(input, filePointer)
    laszip.open(filePointer, input.length)

    // Note that the point size within the file itself may be larger than the
    // schema that we create here because there may be extra-bytes (which we
    // will ignore).  So when we unpack the point into our one-point temporary
    // buffer we need the larger size, but when we copy the point content into
    // our localized buffer we will omit these trailing extra-bytes.
    const schema = Format.create(header)
    const corePointSize = Schema.pointSize(schema)
    const point = Buffer.from(Module.HEAPU8.buffer, dataPointer, corePointSize)

    const length = corePointSize * pointCount
    const output = Buffer.alloc(length)
    for (let pos = 0; pos < length; pos += corePointSize) {
      // Decompress each point and copy it from the Module heap to our buffer.
      laszip.getPoint(dataPointer)
      point.copy(output, pos, 0, corePointSize)
    }

    return View.Readable.create(output, schema)
  } finally {
    Module._free(dataPointer)
    Module._free(filePointer)
    laszip.delete()
  }
}
