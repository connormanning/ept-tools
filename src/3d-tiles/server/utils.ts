import { Options } from '3d-tiles'
import { normalize } from 'protopath'
import { ParsedUrlQuery } from 'querystring'
import { EptToolsError } from 'types'

export function parseQuery(q: ParsedUrlQuery) {
  const options: Partial<Options> = {}

  const {
    ept,
    'z-offset': zOffset,
    dimensions: dimstring,
    truncate,
    ...rest
  } = q

  if (typeof ept === 'string') {
    options.ept = normalize(ept)
  }

  if (typeof zOffset === 'string') {
    options.zOffset = parseFloat(zOffset)
    if (Number.isNaN(options.zOffset)) {
      throw new EptToolsError(`Invalid Z-offset: ${zOffset}`)
    }
  }

  if (typeof dimstring === 'string') {
    options.dimensions = dimstring.split(',').map((s) => s.trim())
  }

  if (typeof truncate === 'string') {
    // This option may be passed as one of the following:
    // - ?truncate
    // - ?truncate=true (or false)
    // - ?truncate=1 (or 0)
    //
    // Other values are invalid.  The valueless version arrives here as ''.

    if (!['', 'true', 'false', '1', '0'].includes(truncate)) {
      throw new EptToolsError(`Invalid "truncate" setting: ${truncate}`)
    }
    options.truncate = ['', 'true', '1'].includes(truncate)
  }

  return { ...options, rest }
}
