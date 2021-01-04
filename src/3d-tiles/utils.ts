// Both the feature table and the batch table JSON must be padded to a multiple
// of 8 bytes with the character 0x20.  Their binary complements must also be
// padded to a multiple of 8 bytes, but with any value.  We'll choose 0.
//
// See https://git.io/JIjB7 and https://git.io/JIjBj.
//
export function padEnd(b: Buffer, c = 0): Buffer {
  const remainder = b.length % 8
  if (!remainder) return b
  return Buffer.concat([b, Buffer.alloc(8 - remainder, c)])
}

export function sumLengths(buffers: Buffer[]) {
  return buffers.reduce((sum, buffer) => sum + buffer.length, 0)
}
