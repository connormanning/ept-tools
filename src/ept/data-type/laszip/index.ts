import Module from 'lib/laz-perf.asm'

import { View } from '../../view'

import * as Format from './format'
import { Header } from './header'

export type type = 'laszip'
export const extension = 'laz'

export const Laszip = { view }

// TODO: Note that currently, the resulting schema doesn't quite match the EPT
// schema, as our Laszip schema doesn't expand the bit fields into their
// respective dimensions: they are combined as the single dimension "Flag".
function view(input: Buffer): View.Readable {
  const header = Header.parse(input)
  const { pointCount, pointSize } = header

  const laszip = new Module.LASZip()
  const filePointer = Module._malloc(input.length)
  const dataPointer = Module._malloc(pointSize)

  try {
    Module.HEAPU8.set(input, filePointer)
    laszip.open(filePointer, input.length)

    const point = Buffer.from(Module.HEAPU8.buffer, dataPointer, pointSize)

    const length = pointSize * pointCount
    const output = Buffer.alloc(length)
    for (let pos = 0; pos < length; pos += pointSize) {
      // Decompress each point and copy it from the Module heap to normal memory.
      laszip.getPoint(dataPointer)
      point.copy(output, pos, 0, pointSize)
    }

    const schema = Format.create(header)

    return View.Readable.create(output, schema)
  } finally {
    Module._free(dataPointer)
    Module._free(filePointer)
    laszip.delete()
  }
}
