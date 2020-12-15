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

export const Srs = { horizontalCodeString }