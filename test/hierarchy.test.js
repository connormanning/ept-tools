import * as Bounds from '../src/bounds'
import * as Hierarchy from '../src/hierarchy'

const srsCodeString = 'EPSG:4978'

test('translates a UTM hierarchy', async () => {
    const nycUtm = [580735.9001774283, 4504694.970845929, 0]
    const nycWgs84 = [-74.0444996762243, 40.68919824733844, 0]
    const nycEcef = [1331340.714375315, -4656583.46257742, 4136313.2510571736]

    const hierarchy = { '0-0-0-0': 1 }
    const bounds = nycUtm.map(v => v - 1).concat(nycUtm.map(v => v + 1))
    const key = [0, 0, 0, 0]
    const geometricError = 100
    const srsCodeString = 'EPSG:26918'

    const root = Hierarchy.translate({
        srsCodeString,
        hierarchy,
        bounds,
        key,
        geometricError
    })
})

test('translates a hierarchy', async () => {
    const hierarchy = {
        '0-0-0-0': 999,
        '1-0-0-0': 1000,
        '1-0-0-1': 1001,
        '2-0-0-0': -1
    }
    const bounds = [0, 0, 0, 64, 64, 64]
    const key = [0, 0, 0, 0]
    const geometricError = 100

    const root = Hierarchy.translate({
        srsCodeString,
        hierarchy,
        bounds,
        key,
        geometricError
    })

    expect(root).toMatchObject({
        content: { uri: '0-0-0-0.pnts' },
        boundingVolume: { box: Bounds.boxify(bounds) },
        geometricError,
        refine: 'ADD',
    })

    const levelOne = root.children
    expect(levelOne.length).toEqual(2)

    const node1000 = levelOne.find(v => v.content.uri === '1-0-0-0.pnts')
    const node1001 = levelOne.find(v => v.content.uri === '1-0-0-1.pnts')

    expect(node1000).toMatchObject({
        content: { uri: '1-0-0-0.pnts' },
        boundingVolume: {
            box: bounds
                |> (v => Bounds.step(v, [0, 0, 0]))
                |> Bounds.boxify
        },
        geometricError: geometricError / 2
    })

    expect(node1001).toMatchObject({
        content: { uri: '1-0-0-1.pnts' },
        boundingVolume: {
            box: bounds
                |> (v => Bounds.step(v, [0, 0, 1]))
                |> Bounds.boxify
        },
        geometricError: geometricError / 2
    })

    expect(node1001.children).toBeFalsy()
    expect(node1000.children.length).toEqual(1)
    const leaf = node1000.children[0]

    expect(leaf).toMatchObject({
        content: { uri: '2-0-0-0.json' },
        boundingVolume: {
            box: bounds
                |> (v => Bounds.step(v, [0, 0, 0]))
                |> (v => Bounds.step(v, [0, 0, 0]))
                |> Bounds.boxify
         },
         geometricError: geometricError / 4
    })
})

test('translate a non-root hierarchy', () => {
    const hierarchy = {
        '1-0-0-0': 1000,
        '2-0-0-0': 2000,
        '3-0-0-0': -1
    }
    const bounds = [0, 0, 0, 50, 50, 50]
    const key = [1, 0, 0, 0]
    const geometricError = 100

    const node = Hierarchy.translate({
        srsCodeString,
        hierarchy,
        bounds,
        key,
        geometricError
    })

    expect(node).toEqual({
        content: { uri: '1-0-0-0.pnts' },
        boundingVolume: { box: Bounds.boxify(bounds) },
        geometricError: 100,
        children: [{
            content: { uri: '2-0-0-0.pnts' },
            geometricError: 50,
            boundingVolume: {
                box: bounds
                    |> (v => Bounds.step(v, [0, 0, 0]))
                    |> Bounds.boxify
            },
            children: [{
                content: { uri: '3-0-0-0.json' },
                geometricError: 25,
                boundingVolume: {
                    box: bounds
                        |> (v => Bounds.step(v, [0, 0, 0]))
                        |> (v => Bounds.step(v, [0, 0, 0]))
                        |> Bounds.boxify
                }
            }]
        }]
    })
})
