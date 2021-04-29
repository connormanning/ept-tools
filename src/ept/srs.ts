export type Srs = {
  wkt?: string
  authority?: string
  horizontal?: string
  vertical?: string
}

const horizontalCodeString = (srs: Srs = {}): string | undefined => {
  const { authority, horizontal } = srs
  if (authority && horizontal) return `${authority}:${horizontal}`
}

const codeString = (srs: Srs = {}): string | undefined => {
  const { authority, horizontal, vertical } = srs
  if (authority && horizontal) {
    if (vertical) return `${authority}:${horizontal}+${vertical}`
    return `${authority}:${horizontal}`
  }
}

export const Srs = { codeString, horizontalCodeString }
