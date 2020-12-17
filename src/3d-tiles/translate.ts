import { basename, dirname, join } from 'protopath'

import { Bounds, DataType, Key, JsonSchema, Srs } from 'ept'
import { EptToolsError } from 'types'
import { Reproject, getBinary, getJson } from 'utils'

import { Pnts } from './pnts'
import { Tileset } from './tileset'
import { Options } from './types'

/**
 * Generates a 3D-Tiles file translation of an EPT dataset at the virtual path
 * <ept-directory>/ept-tileset/.  So the virtual "tileset.json" for an EPT
 * dataset at path "\~/entwine/autzen/ept.json" would be at
 * "\~/entwine/autzen/ept-tileset/tileset.json".
 */
export async function translate(
  filename: string,
  options: Partial<Options> = {}
) {
  const tilesetdir = dirname(filename)
  if (!tilesetdir.endsWith('ept-tileset')) {
    throw new EptToolsError(`Invalid virtual tileset path: ${filename}`)
  }
  const eptdir = join(tilesetdir, '..')
  const ept = JsonSchema.parse(await getJson(join(eptdir, 'ept.json')))

  const { bounds, dataType, schema, srs } = ept
  const codeString = Srs.horizontalCodeString(srs)
  if (!codeString) {
    throw new EptToolsError('Cannot translate to 3D Tiles without an SRS code')
  }

  const tilename = basename(filename)
  const [root, extension] = tilename.split('.')

  // If the extension is JSON, then our result is a translated tileset.  This
  // includes metadata information as well as a translated hierarchy structure.
  if (extension === 'json') {
    const key = root === 'tileset' ? Key.create() : Key.parse(root)
    const hierarchy = JsonSchema.parseHierarchy(
      await getJson(join(eptdir, 'ept-hierarchy', `${Key.stringify(key)}.json`))
    )
    return Tileset.translate({ ept, hierarchy, key })
  }

  if (extension !== 'pnts') {
    throw new EptToolsError(`Invalid file extension: ${extension}`)
  }

  // Otherwise, we are returning binary point data for a single node.  First
  // download the contents of the EPT node and then we'll translate its points
  // into 3D Tiles "pnts" format.
  const key = Key.parse(root)
  const bufferExtension = DataType.extension(dataType)
  const buffer = await getBinary(
    join(eptdir, 'ept-data', `${root}.${bufferExtension}`)
  )

  const view = DataType.view(dataType, buffer, schema)
  const tileBounds = Bounds.stepTo(bounds, key)
  const toEcef = Reproject.create(codeString, 'EPSG:4978')
  return Pnts.translate({ view, tileBounds, toEcef, options })
}
