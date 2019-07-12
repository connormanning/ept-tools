import * as Bounds from './bounds'
import * as Constants from './constants'
import * as Hierarchy from './hierarchy'
import * as Key from './key'
import * as Srs from './srs'

export function translate({ key, hierarchy, ept }) {
    const { bounds: rootBounds, srs } = ept
    const rootGeometricError =
        (rootBounds[3] - rootBounds[0]) / Constants.geometricErrorDivisor
    const geometricError = rootGeometricError / Math.pow(2, Key.depth(key))
    const bounds = Bounds.stepTo(rootBounds, key)

    const srsCodeString = Srs.codeString(srs)

    const root = Hierarchy.translate({
        srsCodeString,
        hierarchy,
        bounds,
        key,
        geometricError
    })

    const tile = { asset: { version: "1.0" }, geometricError, root }
    return tile
}
