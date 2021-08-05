import { join } from 'protopath'

import { Bounds, DataType, Ept, Hierarchy, Key, Srs } from 'ept'
import { Ellipsoid, testdir } from 'test'
import { JsonSchema, Reproject, getBinary, getJson } from 'utils'

import { BoundingVolume, Pnts, Tile, Tileset, translate } from '.'

function flatten({ children = [], ...tile }: Tile): Tile[] {
  return [
    tile,
    ...children.reduce<Tile[]>(
      (tiles, tile) => [...tiles, ...flatten(tile)],
      []
    ),
  ]
}

test('failure: invalid path', async () => {
  await expect(
    translate({ filename: 'something/ept-tileset-BAD/tileset.json' })
  ).rejects.toThrow(/invalid/i)
})

test('success: tileset', async () => {
  const filename = join(testdir, 'ellipsoid-laz/ept-tileset/tileset.json')
  const tileset = await translate({ filename })
  if (Buffer.isBuffer(tileset)) throw new Error('Unexpected translated format')
  const { children } = tileset.root

  const reproject = Reproject.create(Ellipsoid.srsCodeString, 'EPSG:4326')
  const boundsWgs84 = Bounds.reproject(Ellipsoid.bounds, reproject)
  const geometricError =
    Bounds.width(Ellipsoid.bounds) / Tileset.Constants.geometricErrorDivisor

  const { asset } = tileset
  expect(asset).toMatchObject({ version: '1.0' })
  expect(tileset).toEqual<Tileset>({
    root: {
      content: { uri: '0-0-0-0.pnts' },
      boundingVolume: { region: BoundingVolume.Region.fromWgs84(boundsWgs84) },
      geometricError,
      refine: 'ADD',
      children,
    },
    geometricError,
    asset,
  })

  const flat = flatten(tileset.root)
  expect(flat).toHaveLength(Object.keys(Ellipsoid.rootHierarchy).length)

  // Validate all the nested "children" in each tile.  Flatten them and compare
  // each of them to the corresponding hierarchy entry.
  Object.entries(Ellipsoid.rootHierarchy).forEach(([s, points]) => {
    const key = Key.parse(s)

    // Find the tile corresponding to this hierarchy entry.
    const tile = flat.find((v) => v.content.uri.startsWith(s))
    if (!tile) throw new Error(`Missing tile with key ${s}`)

    const extension = points === -1 ? 'json' : 'pnts'
    const bounds = Bounds.reproject(
      Bounds.stepTo(Ellipsoid.bounds, key),
      reproject
    )

    expect(tile).toEqual<Tile>({
      content: { uri: `${s}.${extension}` },
      boundingVolume: { region: BoundingVolume.Region.fromWgs84(bounds) },
      geometricError: geometricError / Math.pow(2, Key.depth(key)),
      refine: Key.depth(key) === 0 ? 'ADD' : undefined,
    })
  })
})

test('success: nested hierarchy', async () => {
  const key = Key.create(2, 0, 1, 1)
  const root = join(testdir, 'ellipsoid-laz')
  const filename = join(root, 'ept-tileset/2-0-1-1.json')
  const tileset = await translate({ filename })
  if (Buffer.isBuffer(tileset)) throw new Error('Unexpected translated format')
  const { children } = tileset.root

  const reproject = Reproject.create(Ellipsoid.srsCodeString, 'EPSG:4326')
  const boundsWgs84 = Bounds.reproject(
    Bounds.stepTo(Ellipsoid.bounds, key),
    reproject
  )
  const rootGeometricError =
    Bounds.width(Ellipsoid.bounds) / Tileset.Constants.geometricErrorDivisor
  const geometricError = rootGeometricError / 2 / 2

  expect(tileset).toEqual<Tileset>({
    root: {
      content: { uri: '2-0-1-1.pnts' },
      boundingVolume: { region: BoundingVolume.Region.fromWgs84(boundsWgs84) },
      geometricError,
      children,
    },
    geometricError,
    asset: { version: '1.0' },
  })

  const flat = flatten(tileset.root)

  // Validate all the nested "children" in each tile.  Flatten them and compare
  // each of them to the corresponding hierarchy entry.
  const [hierarchyNode] = JsonSchema.validate<Hierarchy>(
    Hierarchy.schema,
    await getJson(join(root, 'ept-hierarchy/2-0-1-1.json'))
  )
  expect(flat).toHaveLength(Object.keys(hierarchyNode).length)
  Object.entries(hierarchyNode).forEach(([s, points]) => {
    const key = Key.parse(s)

    // Find the tile corresponding to this hierarchy entry.
    const tile = flat.find((v) => v.content.uri.startsWith(s))
    if (!tile) throw new Error(`Missing tile with key ${s}`)

    const extension = points === -1 ? 'json' : 'pnts'
    const bounds = Bounds.reproject(
      Bounds.stepTo(Ellipsoid.bounds, key),
      reproject
    )

    expect(tile).toEqual<Tile>({
      content: { uri: `${s}.${extension}` },
      boundingVolume: { region: BoundingVolume.Region.fromWgs84(bounds) },
      geometricError: rootGeometricError / Math.pow(2, Key.depth(key)),
    })
  })
})

test('failure: no srs code', async () => {
  const filename = join(testdir, 'no-srs-code/ept-tileset/tileset.json')
  await expect(translate({ filename })).rejects.toThrow(/without an srs code/i)
})

test('failure: invalid file extension', async () => {
  const filename = join(testdir, 'ellipsoid-bin/ept-tileset', `0-0-0-0.abc`)
  await expect(translate({ filename })).rejects.toThrow(
    /invalid file extension/i
  )
})

test('success: xyz/rgb/i', async () => {
  // Set up some supporting metadata.  We'll be focusing on the translation of a
  // single node here: the 1-0-0-0 node.
  const key = Key.create(1, 0, 0, 0)
  const keyString = Key.stringify(key)
  const base = join(testdir, 'ellipsoid-bin')

  // Grab the data we'll need from the EPT dataset.  We'll fetch the EPT
  // metadata, the hierarchy to check the number of points, and the binary node
  // data itself to compare points.
  const [ept] = JsonSchema.validate<Ept>(Ept.schema, await getJson(join(base, 'ept.json')))
  const [hierarchy] = JsonSchema.validate<Hierarchy>(
    Hierarchy.schema,
    await getJson(join(base, 'ept-hierarchy/0-0-0-0.json'))
  )
  const bin = await getBinary(join(base, 'ept-data', `${keyString}.bin`))

  const numPoints = hierarchy[keyString]
  expect(numPoints).toBeGreaterThan(0)

  // Now get our translation of this node as a 3D Tiles "pnts" file.
  const filename = join(
    testdir,
    'ellipsoid-bin/ept-tileset',
    `${keyString}.pnts`
  )
  const pnts = await translate({
    filename,
    options: { dimensions: ['Intensity'] },
  })
  if (!Buffer.isBuffer(pnts)) throw new Error('Unexpected translate format')

  // First pluck the values out of the header and make sure they make sense.
  const header = pnts.slice(0, Pnts.Constants.headerSize)
  const magic = header.toString('utf8', 0, 4)
  const version = header.readUInt32LE(4)
  const total = header.readUInt32LE(8)
  const featureTableHeaderSize = header.readUInt32LE(12)
  const featureTableBinarySize = header.readUInt32LE(16)
  const batchTableHeaderSize = header.readUInt32LE(20)
  const batchTableBinarySize = header.readUInt32LE(24)

  expect(magic).toEqual('pnts')
  expect(version).toEqual(1)
  expect(total).toEqual(pnts.length)

  const ceil8 = (n: number) => Math.ceil(n / 8) * 8
  // XYZ + RGB.
  expect(featureTableBinarySize).toEqual(
    ceil8(numPoints * (Pnts.Constants.xyzSize + Pnts.Constants.rgbSize))
  )
  // Intensity + Classification.
  expect(batchTableBinarySize).toEqual(ceil8(numPoints * 2))

  // Now we'll verify the feature table JSON metadata.  It's not particularly
  // interesting but we need to check that our point count matches the expected
  // and that the tile's center offset matches our expectation in ECEF.
  const codeString = Srs.horizontalCodeString(ept.srs)
  if (!codeString) throw new Error('Unexpected lack of SRS code')
  const toEcef = Reproject.create(codeString, 'EPSG:4978')
  const tileBounds = Bounds.stepTo(ept.bounds, key)
  const ecefCenter = Bounds.mid(Bounds.reproject(tileBounds, toEcef))

  const featureTable: Pnts.FeatureTable.Header = JSON.parse(
    pnts.slice(header.length, header.length + featureTableHeaderSize).toString()
  )
  expect(featureTable).toEqual<Pnts.FeatureTable.Header>({
    POINTS_LENGTH: numPoints,
    RTC_CENTER: ecefCenter,
    POSITION: { byteOffset: 0 },
    RGB: { byteOffset: numPoints * Pnts.Constants.xyzSize },
  })

  const batchTableBegin =
    pnts.length - batchTableBinarySize - batchTableHeaderSize
  const batchTable: Pnts.BatchTable.Header = JSON.parse(
    pnts
      .slice(batchTableBegin, batchTableBegin + batchTableHeaderSize)
      .toString()
  )
  expect(batchTable).toEqual<Pnts.BatchTable.Header>({
    Intensity: {
      byteOffset: 0,
      componentType: 'UNSIGNED_SHORT',
      type: 'SCALAR',
    },
  })

  const view = await DataType.view('binary', bin, ept.schema)
  const binaryOffset = header.length + featureTableHeaderSize

  // And now we'll compare the point data.
  {
    // First the XYZ.
    const data = pnts.slice(
      binaryOffset,
      binaryOffset + featureTable.RGB!.byteOffset
    )

    const getters = [view.getter('X'), view.getter('Y'), view.getter('Z')]
    for (let i = 0; i < numPoints; ++i) {
      const [x, y, z] = getters.map((get) => get(i))
      const expected = toEcef([x, y, z]).map((v, i) => v - ecefCenter[i])
      expect(data.readFloatLE(i * 12 + 0)).toBeCloseTo(expected[0], 4)
      expect(data.readFloatLE(i * 12 + 4)).toBeCloseTo(expected[1], 4)
      expect(data.readFloatLE(i * 12 + 8)).toBeCloseTo(expected[2], 4)
    }
  }

  {
    // And then the RGB.
    const rgbOffset = binaryOffset + featureTable.RGB!.byteOffset
    const data = pnts.slice(
      rgbOffset,
      rgbOffset + numPoints * Pnts.Constants.rgbSize
    )

    const getters = [
      view.getter('Red'),
      view.getter('Green'),
      view.getter('Blue'),
    ]
    for (let i = 0, offset = 0; i < numPoints; ++i) {
      getters
        .map((get) => get(i))
        .forEach((v) => {
          expect(v).toEqual(data.readUInt8(offset++))
        })
    }
  }

  {
    // And finally the Intensity from the batch table.
    const intensityOffset = batchTableBegin + batchTableHeaderSize
    const data = pnts.slice(intensityOffset, intensityOffset + numPoints * 2)

    const get = view.getter('Intensity')
    for (let i = 0; i < numPoints; ++i) {
      expect(get(i)).toEqual(data.readUInt16LE(i * 2))
    }
  }
})
