import { Options } from '3d-tiles'
import { ParsedUrlQuery } from 'querystring'
import { EptToolsError } from 'types'

export function parseQuery(q: ParsedUrlQuery) {
  const options: Partial<Options> = {}

  const { 'z-offset': zOffset, dimensions: dimstring, truncate } = q
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
    // - ?truncate=true
    // - ?truncate=false
    //
    // Other values are invalid.  The valueless version arrives here as ''.

    if (!['', 'true', 'false'].includes(truncate)) {
      throw new EptToolsError(`Invalid "truncate" setting: ${truncate}`)
    }
    options.truncate = truncate === '' || truncate === 'true'
  }

  return options
}
