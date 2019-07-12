import Bounds from './bounds'

export function create(d, x, y, z) {
    return [d, x, y, z].map(v => v || 0)
}

export function depth([d]) {
    return d
}

export function step([d, x, y, z], [a, b, c]) {
    return [
        d + 1,
        x * 2 + a,
        y * 2 + b,
        z * 2 + c
    ]
}

export function stringify(key) {
    return key.join('-')
}
