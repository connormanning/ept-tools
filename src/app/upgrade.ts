import { Driver, Forager } from 'forager'
import { mkdirp } from 'fs-extra'
import { basename, join, parse, stripProtocol } from 'protopath'

import { Ept, Source } from 'ept'
import { JsonSchema, Pool, ValidationError } from 'utils'

/*
async function readJson(storage: Driver, filename: string) {
  return JSON.parse((await storage.read(filename)).toString())
}

async function readList0(storage: Driver, filename: string) {
  const json = await readJson(storage, filename)
  const [list, errors] = JsonSchema.validate<Source.V0.Summary>(
    Source.V0.summary.schema,
    json
  )
  if (errors.length) {
    throw new ValidationError(
      'Failed to vaildate data source summary v1.0.0',
      errors
    )
  }
  return list
}
*/

type MaybeBackup = {
  dir: string
  threads: number
  verbose: boolean
}
async function maybeBackup({ dir: src, threads, verbose }: MaybeBackup) {
  const dst = join(src, 'ept-backup')
  if (Forager.getProtocolOrDefault(dst) === 'file') {
    await mkdirp(dst)
    await mkdirp(join(dst, 'ept-sources'))
  }

  // If our original metadata is already backed up, we're done here.
  {
    const list = await Forager.list(dst, false)
    const exists = Boolean(list.find((v) => v.path === 'ept.json'))
    if (exists) {
      if (verbose) console.log(`Metadata for ${src} already backed up`)
      return
    }
  }

  if (verbose) console.log('Backing up metadata...')

  // Copy the source file metadata.
  const sources = await Forager.list(join(src, 'ept-sources'), true)
  await Pool.all(
    sources.map((v) => async () =>
      Forager.copyFile(
        join(src, 'ept-sources', v.path),
        join(dst, 'ept-sources', v.path)
      )
    ),
    threads
  )

  // And finally, ept.json, which is intentionally the last item since we use it
  // as a sentinel to determine whether our metadata is already backed up.
  await Forager.copyFile(join(src, 'ept.json'), join(dst, 'ept.json'))

  if (verbose) console.log('\tMetadata backup complete')
}

type UpgradeDir = {
  dir: string
  threads?: number
  limit?: number
  verbose?: boolean
}
type UpgradeDirResultItem = {
  subdir: string
  isUpgraded?: boolean
  error?: string
}
type UpgradeDirResult = UpgradeDirResultItem[]
export async function upgradeDir({
  dir,
  threads,
  limit = Infinity,
  verbose,
}: UpgradeDir) {
  if (verbose) {
    console.log(`Upgrading EPT datasets within ${dir}`)
    if (limit !== Infinity) {
      console.log(`Upgrading a maximum of ${limit} datasets`)
    }
    console.log(`Listing ${dir}...`)
  }

  const list = (await Forager.list(dir, false))
    .filter((v) => v.type === 'directory')
    .map((v) => v.path)

  if (verbose) {
    console.log(`\tFound ${list.length} subdirectories`)
  }

  let upgradedCount = 0
  const result: UpgradeDirResult = []

  let i = 0
  for (const subdir of list) {
    if (verbose) {
      const s =
        `\nUpgrading ${i + 1}/${list.length}` +
        (limit !== Infinity ? ` (limit ${upgradedCount}/${limit})` : '') +
        `: ${subdir}`
      console.log(s)
    }

    try {
      const isUpgraded = await upgradeOne({
        filename: join(dir, subdir, 'ept.json'),
        threads,
        verbose,
      })
      if (isUpgraded) ++upgradedCount

      result.push({ subdir, isUpgraded })
    } catch (e) {
      if (verbose) console.log(`Error during ${subdir}: ${e.message}`)
      result.push({ subdir, error: e.message || 'Unknown error' })
    }

    ++i

    if (upgradedCount >= limit) {
      if (verbose) console.log('Reached upgrade limit')
      break
    }
  }

  if (verbose) console.log('All upgrades complete')

  return result
}

type UpgradeOne = {
  filename: string
  threads?: number
  verbose?: boolean
  force?: boolean
}
export async function upgradeOne({
  filename,
  threads = 8,
  verbose = false,
  force = false,
}: UpgradeOne) {
  if (!filename.endsWith('ept.json')) {
    throw new Error('Filename must end with "ept.json"')
  }
  const dir = join(filename, '..')

  if (await getIsCurrent(dir, verbose)) {
    if (!force) {
      if (verbose) console.log('\tDataset is up to date')
      return false
    } else if (verbose) {
      console.log('\tDataset is up to date - but re-upgrading due to --force')
    }
  }

  // We're going to write new files - first back everything up.
  const backup = join(dir, 'ept-backup')
  await maybeBackup({ dir, threads, verbose })

  // From now on, we're always going to read from our backup, which always
  // represents the original dataset before any upgrade attempts.
  if (verbose) console.log('Getting EPT...')
  const eptjson = await Forager.readJson(join(backup, 'ept.json'))

  /*
  // A few extremely old datasets have this issue.
  if (!eptjson.points && eptjson.numPoints) {
    eptjson.points = eptjson.numPoints
    delete eptjson.numPoints
  }
  */
  const [ept, errors] = JsonSchema.validate<Ept>(Ept.schema, eptjson)
  if (errors.length) {
    if (verbose) errors.forEach((e) => console.log(`! ${e}`))
    throw new Error('Invalid EPT')
  }

  if (verbose) console.log('\tDone')

  // Unfortunately we've got some data generated by an unreleased version of
  // Entwine - which generated ept-sources/ in version 1.1.0 format but wrote
  // their EPT version as 1.0.0.  So we can't trust the version of the backed up
  // metadata.  Regardless, we're always going to output version 1.1.0.
  if (verbose && ept.version !== '1.1.0') {
    console.log('Incrementing EPT version to 1.1.0')
  }
  ept.version = '1.1.0'

  if (!(await getHasV1Sources(backup))) {
    if (verbose) console.log('Awakening and validating source file metadata...')
    const [oldsummary, olddetail] = await awakenFromV0(
      join(backup, 'ept-sources'),
      verbose
    )

    const [summary, detail] = upgradeFromV0(oldsummary, olddetail)
    if (verbose) console.log('\tDone')

    {
      const [, errors] = JsonSchema.validate(Source.summary.schema, summary)
      if (errors.length) {
        if (verbose) errors.forEach((e) => console.log(e))
        throw new Error(
          'Internal error: failed to update metadata summary - aborting'
        )
      }
    }
    {
      detail.forEach((d) => {
        const [, errors] = JsonSchema.validate(Source.detail.schema, d)
        if (errors.length) {
          if (verbose) errors.forEach((e) => console.log(d.path, e))
          throw new Error(
            'Internal error: failed to update metadata detail - aborting'
          )
        }
      })
    }

    if (verbose) console.log('Writing updated source file metadata...')
    await Pool.all(
      detail.map((v, i) => async () => {
        const filename = summary[i].metadataPath
        return Forager.write(
          join(dir, 'ept-sources', filename),
          JSON.stringify(v, null, 2)
        )
      }),
      threads
    )
    await Forager.write(
      join(dir, 'ept-sources/manifest.json'),
      JSON.stringify(summary, null, 2)
    )
    if (verbose) console.log('\tDone')
  } else {
    if (verbose) console.log('Source file metadata is up to date')
  }

  await Forager.write(join(dir, 'ept.json'), JSON.stringify(ept, null, 2))

  if (verbose) console.log('\tUpgrades complete - EPT version 1.1.0', dir)
  return true
}

async function getIsCurrent(dir: string, verbose = false) {
  const eptjson = await Forager.readJson(join(dir, 'ept.json'))
  const [ept, errors] = JsonSchema.validate<Ept>(Ept.schema, eptjson)
  if (errors.length) {
    if (verbose) errors.forEach((e) => console.log(e))
    throw new Error('Invalid EPT metadata')
  }
  return ept.version === '1.1.0'
}

// Return true if the data-sources/ directory has a manifest.json in it, and its
// contents are valid.  Throws if this file exists but is not valid.
async function getHasV1Sources(dir: string, verbose = true) {
  const rawmanifest = await (async () => {
    try {
      return (await Forager.readJson(
        join(dir, 'ept-sources/manifest.json')
      )) as unknown
    } catch (e) {}
  })()

  if (!rawmanifest) return false

  const [, errors] = JsonSchema.validate<Source.Summary>(
    Source.summary.schema,
    rawmanifest
  )

  if (errors.length) {
    if (verbose) errors.forEach((e) => console.log(e))
    throw new Error('Invalid data source manifest v1.1.0')
  }

  return true
}

async function awakenFromV0(
  dir: string,
  verbose = false
): Promise<[Source.V0.Summary, Source.V0.Detail]> {
  const [summary, errors] = JsonSchema.validate<Source.V0.Summary>(
    Source.V0.summary.schema,
    await Forager.readJson(join(dir, 'list.json'))
  )
  if (errors.length) {
    if (verbose) errors.forEach((e) => console.log(e))
    throw new Error('Invalid source file metadata v1.0.0')
  }

  const chunkFilenames = [
    ...summary.reduce<Set<string>>((set, item) => {
      if (item.url) set.add(item.url)
      return set
    }, new Set<string>()),
  ]

  // Aggregate all of the detail objects into a single object.
  const detail = (
    await Pool.all(
      chunkFilenames.map((filename) => async () => {
        const [chunk, errors] = JsonSchema.validate<Source.V0.Detail>(
          Source.V0.detail.schema,
          await Forager.readJson(join(dir, filename))
        )
        if (errors.length) {
          if (verbose) errors.forEach((e) => console.log(e))
          throw new Error(`Failed validation: ${filename}`)
        }
        return chunk
      })
    )
  ).reduce<Source.V0.Detail>((agg, cur) => ({ ...agg, ...cur }), {})

  return [summary, detail]
}

function upgradeFromV0(
  oldsummary: Source.V0.Summary,
  olddetail: Source.V0.Detail
): [Source.Summary, Source.Detail[]] {
  const summary = oldsummary
    // For omitted paths, these may not exist, but we don't want to propagate
    // those ones to V1.
    .filter((v) => v.bounds && v.points)
    .map<Source.Summary.Item>((v) => ({
      path: v.path,
      points: v.points!,
      bounds: v.bounds!,
      // In the older version, we would include non-point-cloud files in a source
      // directory as "omitted" files, but we're skipping that now and only
      // storing statuses for actual inputs.
      inserted: v.status === 'inserted' || v.status === 'error',
      // The metadata path is tentative - if the basenames are not unique, we'll
      // have to update these later.
      metadataPath: `${parse(v.path).name}.json`,
    }))

  // Handle the crazy edge case where a point cloud file is named something like
  // manifest.laz and we want to make sure it doesn't conflict with our
  // manfiest.json metadata file.
  for (const item of summary) {
    if (item.metadataPath === 'manifest.json') {
      item.metadataPath = 'manifestpc.json'
    }
  }

  // If our metadata paths, computed from the input filenames, are not unique,
  // then we'll just call them 0.json ... N.json.
  const namesUnique =
    new Set<string>([...summary.map((v) => v.metadataPath)]).size ===
    summary.length
  if (!namesUnique) summary.forEach((v, i) => (v.metadataPath = `${i}.json`))

  const detail: Source.Detail[] = summary.map((v, i) => {
    const id = oldsummary[i].id
    const from = olddetail[id]
    return {
      bounds: v.bounds,
      path: v.path,
      points: v.points,
      metadata: from?.metadata,
      srs: from.srs,
    }
  })

  return [summary, detail]
}
