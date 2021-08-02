import { Schema } from 'ajv'

export type Srs = {
  wkt?: string
  authority?: string
  horizontal?: string
  vertical?: string
}

const schema: Schema = {
  title: 'Spatial reference',
  description: 'Spatial reference codes and WKT',
  type: 'object',
  properties: {
    authority: { type: 'string' },
    horizontal: { type: 'string' },
    vertical: { type: 'string' },
    wkt: { type: 'string' },
  },
  dependencies: {
    authority: ['horizontal'],
    horizontal: ['authority'],
    vertical: ['horizontal'],
  },
}

export const Srs = { schema, codeString, horizontalCodeString }

function horizontalCodeString(srs: Srs = {}): string | undefined {
  const { authority, horizontal } = srs
  if (authority && horizontal) return `${authority}:${horizontal}`
}

function codeString(srs: Srs = {}): string | undefined {
  const { authority, horizontal, vertical } = srs
  if (authority && horizontal) {
    if (vertical) return `${authority}:${horizontal}+${vertical}`
    return `${authority}:${horizontal}`
  }
}
