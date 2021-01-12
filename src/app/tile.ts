import { Storage } from 'cropy'
import { mkdirp } from 'fs-extra'
import { getProtocol, getStem, join } from 'protopath'

import * as Cesium from '3d-tiles'
import { EptToolsError } from 'types'
import { Pool, isReadable } from 'utils'

type Tile = {
  input: string
  output: string
  threads: number
  force: boolean
  verbose: boolean
  options?: Partial<Cesium.Options>
}
export async function tile(args: Tile) {
  const { force, verbose, output } = args
  if (!force && (await isReadable(join(output, 'tileset.json')))) {
    throw new EptToolsError('Output already exists - use --force to overwrite')
  }

  const protocol = getProtocol(output) || 'file'
  if (protocol === 'file') await mkdirp(output)

  // Metadata.
  if (verbose) {
    console.log('Translating metadata...')
    console.time('Metadata')
  }

  await translateMetadata(args)

  if (verbose) console.timeEnd('Metadata')

  // Points.
  if (verbose) {
    console.log('Translating points...')
    console.time('Points')
  }

  await translatePoints(args)

  if (verbose) console.timeEnd('Points')
}

async function translateMetadata({
  input,
  output,
  threads,
  options,
  verbose,
}: Tile) {
  const root = join(input, 'ept-hierarchy')
  const list = (await Storage.list(root)).map(({ path }) =>
    path === '0-0-0-0.json' ? 'tileset.json' : path
  )

  return Pool.all(
    list.map((filename, i) => async () => {
      if (verbose) console.log(`${i}/${list.length}:`, filename)

      const data = await Cesium.translate(
        join(input, 'ept-tileset', filename),
        options
      )

      if (data instanceof Buffer) {
        throw new EptToolsError(`Unexpected response type during ${filename}`)
      }

      return Storage.write(join(output, filename), JSON.stringify(data))
    }),
    threads
  )
}

async function translatePoints({
  input,
  output,
  threads,
  options,
  verbose,
}: Tile) {
  const root = join(input, 'ept-data')
  const list = (await Storage.list(root)).map(
    ({ path }) => getStem(path) + '.pnts'
  )

  return Pool.all(
    list.map((filename, i) => async () => {
      if (verbose) console.log(`${i}/${list.length}:`, filename)

      const data = await Cesium.translate(
        join(input, 'ept-tileset', filename),
        options
      )

      if (!(data instanceof Buffer)) {
        throw new EptToolsError(`Unexpected response type during ${filename}`)
      }

      return Storage.write(join(output, filename), data)
    }),
    threads
  )
}
