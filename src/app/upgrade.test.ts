import { Forager } from 'forager'
import { copy, mkdir, remove } from 'fs-extra'
import { join } from 'protopath'

import { Ept, Source } from 'ept'
import { JsonSchema } from 'utils'

import { upgradeDir, upgradeOne } from './upgrade'

const datadir = join(__dirname, '../test/data')
const tmpdir = join(datadir, 'tmp')

const oldsourcedir = join(datadir, 'v1.0.0')
const mixsourcedir = join(datadir, 'vmixed')
const newsourcedir = join(datadir, 'v1.1.0')

const olddir = join(tmpdir, 'old')
const mixdir = join(tmpdir, 'mix')
const newdir = join(tmpdir, 'new')

beforeEach(async () => {
  await remove(tmpdir)

  await copy(oldsourcedir, olddir)
  await copy(mixsourcedir, mixdir)
  await copy(newsourcedir, newdir)

  await mkdir(join(tmpdir, 'junk'))
  await Forager.write(join(tmpdir, 'junk/ept.json'), 'Junk')
})

afterEach(async () => {
  await remove(tmpdir)
})

test('new', async () => {
  // This dataset is already v1.1.0, so nothing should change, and nothing
  // should be backed up.
  const isUpgraded = await upgradeOne({ filename: join(newdir, 'ept.json') })
  expect(isUpgraded).toBe(false)

  // No backup should have been made.
  await expect(Forager.list(join(newdir, 'ept-backup'))).rejects.toThrow()

  // All files should be exactly the same as before.
  const files = await Forager.list(newsourcedir, true)
  for (const { path } of files) {
    expect(await Forager.read(join(newsourcedir, path))).toEqual(
      await Forager.read(join(newdir, path))
    )
  }
  {
    const [, errors] = JsonSchema.validate<Source.V0.Summary>(
      Source.V0.summary.schema,
      await Forager.readJson(join(newdir, 'ept-sources/list.json'))
    )
    expect(errors).toHaveLength(0)
  }
})

test('old', async () => {
  const isUpgraded = await upgradeOne({ filename: join(olddir, 'ept.json') })
  expect(isUpgraded).toBe(true)

  // We should have a backup which is identical to the original contents.
  {
    const files = (await Forager.list(join(oldsourcedir), true))
      .map((v) => v.path)
      .filter((v) => !v.includes('ept-hierarchy'))

    for (const filename of files) {
      const src = await Forager.read(join(oldsourcedir, filename))
      const dst = await Forager.read(join(olddir, 'ept-backup', filename))
      if (Buffer.compare(src, dst)) console.log(`${filename} does not match`)
      expect(Buffer.compare(src, dst)).toEqual(0)
    }
  }

  const [ept, epterrors] = JsonSchema.validate<Ept>(
    Ept.schema,
    await Forager.readJson(join(olddir, 'ept.json'))
  )
  expect(ept.version).toEqual('1.1.0')
  expect(epterrors).toHaveLength(0)

  const [, errors] = JsonSchema.validate<Source.Summary>(
    Source.summary.schema,
    await Forager.readJson(join(olddir, 'ept-sources/manifest.json'))
  )
  expect(errors).toHaveLength(0)
})

test('mix', async () => {
  const isUpgraded = await upgradeOne({ filename: join(mixdir, 'ept.json') })
  expect(isUpgraded).toBe(true)

  // We should have a backup which is identical to the original contents.
  {
    const files = (await Forager.list(join(mixsourcedir), true))
      .map((v) => v.path)
      .filter((v) => !v.includes('ept-hierarchy'))

    for (const filename of files) {
      const src = await Forager.read(join(mixsourcedir, filename))
      const dst = await Forager.read(join(mixdir, 'ept-backup', filename))
      if (Buffer.compare(src, dst)) console.log(`${filename} does not match`)
      expect(Buffer.compare(src, dst)).toEqual(0)
    }
  }

  const [ept, epterrors] = JsonSchema.validate<Ept>(
    Ept.schema,
    await Forager.readJson(join(mixdir, 'ept.json'))
  )
  expect(ept.version).toEqual('1.1.0')
  expect(epterrors).toHaveLength(0)

  {
    const [, errors] = JsonSchema.validate<Source.Summary>(
      Source.summary.schema,
      await Forager.readJson(join(mixdir, 'ept-sources/manifest.json'))
    )
    expect(errors).toHaveLength(0)
  }
  {
    const [, errors] = JsonSchema.validate<Source.V0.Summary>(
      Source.V0.summary.schema,
      await Forager.readJson(join(mixdir, 'ept-sources/list.json'))
    )
    expect(errors).toHaveLength(0)
  }
})

test('dir', async () => {
  const results = await upgradeDir({ dir: tmpdir, verbose: false })

  const o = results.find((v) => v.subdir === 'old')
  const m = results.find((v) => v.subdir === 'mix')
  const n = results.find((v) => v.subdir === 'new')
  const j = results.find((v) => v.subdir === 'junk')

  expect(o).toEqual({ subdir: 'old', isUpgraded: true })
  expect(m).toEqual({ subdir: 'mix', isUpgraded: true })
  expect(n).toEqual({ subdir: 'new', isUpgraded: false })
  expect(typeof j?.error === 'string').toBe(true)
})
