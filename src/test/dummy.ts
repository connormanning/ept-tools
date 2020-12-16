import * as Ept from 'ept'

const xyz: Ept.Schema = [
  { name: 'X', type: 'signed', size: 4, scale: 0.01, offset: 0 },
  { name: 'Y', type: 'signed', size: 4, scale: 0.01, offset: 0 },
  { name: 'Z', type: 'signed', size: 4, scale: 0.01, offset: 0 },
]

const rgb: Ept.Schema = [
  { name: 'Red', type: 'unsigned', size: 2 },
  { name: 'Green', type: 'unsigned', size: 2 },
  { name: 'Blue', type: 'unsigned', size: 2 },
]

const xyzrgb: Ept.Schema = [...xyz, ...rgb]
const xyzrgbi: Ept.Schema = [
  ...xyzrgb,
  { name: 'Intensity', type: 'signed', size: 2 },
]

export const Schema = { xyz, rgb, xyzrgb, xyzrgbi }
