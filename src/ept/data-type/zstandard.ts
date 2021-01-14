/// <reference types="../../types/global" />
import { Streaming, ZstdCodec } from 'zstd-codec'

import { Schema } from 'ept'
import { View } from '../view'

const streamingPromise = new Promise<Streaming>((resolve) =>
  ZstdCodec.run((zstd) => resolve(new zstd.Streaming()))
)

export const Zstandard = {
  view: async (compressed: Buffer, schema: Schema) => {
    const streaming = await streamingPromise
    const buffer = Buffer.from(streaming.decompress(compressed))
    return View.Readable.create(buffer, schema)
  },
}
