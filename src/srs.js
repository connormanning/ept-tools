export function create(s) {
    if (!s) return { }

    const [authority, compoundCode] = s.split(':')
    if (!compoundCode) return { }

    const [horizontal, vertical] = compoundCode.split('+')
        .map(v => v ? parseInt(v) : v)

    if (!authority || !horizontal) return { }
    if (!vertical) return { authority, horizontal }
    return { authority, horizontal, vertical }
}

export function codeString(srs = { }) {
    const { authority, horizontal, vertical } = srs
    if (!authority) return null
    if (!horizontal) {
        throw new Error('Invalid SRS: `authority` without `horizontal`')
    }
    return `${authority}:${horizontal}` + (vertical ? `+${vertical}` : '')
}

export function stringify(srs = { }) {
    const { authority, wkt } = srs
    if (authority) return codeString(srs)
    return wkt || null
}
