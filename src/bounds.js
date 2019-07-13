export function min(bounds) { return bounds.slice(0, 3) }
export function max(bounds) { return bounds.slice(3) }
export function mid([minx, miny, minz, maxx, maxy, maxz]) {
    return [
        minx + (maxx - minx) / 2,
        miny + (maxy - miny) / 2,
        minz + (maxz - minz) / 2
    ]
}

export function width(bounds) {
    return bounds[3] - bounds[0]
}
export function depth(bounds) {
    return bounds[4] - bounds[1]
}
export function height(bounds) {
    return bounds[5] - bounds[2]
}

export function contains([minx, miny, minz, maxx, maxy, maxz], [x, y, z]) {
    return (
        x >= minx && x < maxx &&
        y >= miny && y < maxy &&
        z >= minz && z < maxz
    )
}

export function step(bounds, [a, b, c]) {
    const [minx, miny, minz, maxx, maxy, maxz] = bounds
    const [midx, midy, midz] = mid(bounds)

    return [
        a ? midx : minx,
        b ? midy : miny,
        c ? midz : minz,
        a ? maxx : midx,
        b ? maxy : midy,
        c ? maxz : midz
    ]
}

export function stepTo(rootBounds, [depth, x, y, z]) {
    let bounds = rootBounds
    for (let i = depth - 1; i >= 0; --i) {
        bounds = step(bounds, [
            (x >> i) & 1,
            (y >> i) & 1,
            (z >> i) & 1,
        ])
    }
    return bounds
}

// Applicable for ECEF bounds only.
export function boxify(bounds) {
    const [midx, midy, midz] = mid(bounds)
    const radius = midx - bounds[0]
    return [
        midx, midy, midz,
        radius, 0, 0,
        0, radius, 0,
        0, 0, radius
    ]
}

// Applicable for WGS84 bounds only.
export function regionify([minx, miny, minz, maxx, maxy, maxz]) {
    // https://git.io/fjXUz
    return [
        minx * Math.PI / 180,
        miny * Math.PI / 180,
        maxx * Math.PI / 180,
        maxy * Math.PI / 180,
        minz,
        maxz
    ]
}
