import { ZstdCodec } from 'zstd-codec'

export async function decompress(compressed) {
    const zstd = await new Promise(resolve => ZstdCodec.run(resolve))
    const streaming = new zstd.Streaming()
    const array = await streaming.decompress(compressed)
    return Buffer.from(array.buffer)
}
