declare module 'zstd-codec' {
  class Streaming {
    constructor()
    decompress(compressed: Uint8Array): Uint8Array
  }

  type Zstd = { Streaming: typeof Streaming }

  class ZstdCodec {
    static run(cb: (zstd: Zstd) => void): void
  }
}
