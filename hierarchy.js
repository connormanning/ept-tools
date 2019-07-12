import _ from 'lodash'

import * as Bounds from './bounds'
import * as Key from './key'

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
            hierarchy,
            bounds: nextBounds,
            key: nextKey,
            geometricError: geometricError / 2
        }))
    }, [])

    const points = hierarchy[Key.stringify(key)]
    const extension = points < 0 ? '.json' : '.pnts'

    return _.assign(
        {
            content: { uri: Key.stringify(key) + extension },
            boundingVolume: { box: Bounds.boxify(bounds) },
            geometricError
        },
        Key.depth(key) === 0 ? { refine: 'ADD' } : null,
        children.length ? { children } : null
    )
}
