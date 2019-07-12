import _ from 'lodash'

import * as Bounds from './bounds'
import * as Key from './key'
import * as Proj from './proj'

const steps = [
    [0, 0, 0],
    [0, 0, 1],
    [0, 1, 0],
    [0, 1, 1],
    [1, 0, 0],
    [1, 0, 1],
    [1, 1, 0],
    [1, 1, 1],
]

export function translate({
    srsCodeString,
    hierarchy,
    bounds,
    key,
    geometricError
}) {
    const children = steps.reduce((children, step) => {
        const nextKey = Key.step(key, step)
        const points = hierarchy[Key.stringify(nextKey)]

        if (!points) return children
        const nextBounds = Bounds.step(bounds, step)

        return children.concat(translate({
            srsCodeString,
            hierarchy,
            bounds: nextBounds,
            key: nextKey,
            geometricError: geometricError / 2
        }))
    }, [])

    const points = hierarchy[Key.stringify(key)]
    const extension = points < 0 ? '.json' : '.pnts'

    let boundingVolume
    if (Proj.isEcef(srsCodeString)) {
        boundingVolume = { box: Bounds.boxify(bounds) }
    }
    else {
        const toWgs84 = Proj.wgs84Converter(srsCodeString)
        const wgs84Bounds = toWgs84(Bounds.min(bounds))
            .concat(toWgs84(Bounds.max(bounds)))

        boundingVolume = { region: Bounds.regionify(wgs84Bounds) }
    }

    return _.assign(
        {
            content: { uri: Key.stringify(key) + extension },
            boundingVolume,
            geometricError
        },
        Key.depth(key) === 0 ? { refine: 'ADD' } : null,
        children.length ? { children } : null
    )
}
