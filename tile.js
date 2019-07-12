import * as Bounds from './bounds'
import * as Constants from './constants'
import * as Hierarchy from './hierarchy'
import * as Key from './key'

export function translate({ key, hierarchy, ept }) {
    const rootGeometricError =
        (ept.bounds[3] - ept.bounds[0]) / Constants.geometricErrorDivisor
    const geometricError = rootGeometricError / Math.pow(2, Key.depth(key))
    const rootBounds = ept.bounds
    const bounds = Bounds.stepTo(rootBounds, key)

    const root = Hierarchy.translate({
        hierarchy,
        bounds,
        key,
        geometricError
    })

    const tile = { asset: { version: "1.0" }, geometricError, root }
    return tile
}
