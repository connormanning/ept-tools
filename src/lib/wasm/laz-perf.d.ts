declare module 'lib/wasm/laz-perf' {
  // Represents an offset into the HEAPU8.
  type Pointer = number

	function onRuntimeInitialized(): void

  class LASZip {
    constructor()
    open(pointer: Pointer, length: number): void
    delete(): void
    getPoint(pointer: Pointer): void
  }

  class HEAPU8 {
    static buffer: ArrayBuffer
    static set(buffer: ArrayBuffer, pointer: Pointer): void
  }

  function _free(pointer: Pointer): void
  function _malloc(length: number): Pointer
}
