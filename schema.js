export function find(schema, name) {
    return schema.find(d => d.name === name)
}

export function has(schema, name) {
    return !!find(schema, name)
}

export function offset(schema, name) {
    let o = 0
    for (const dimension of schema) {
        if (dimension.name === name) return o
        o += dimension.size
    }
    throw new Error('Dimension not found: ' + name)
}

export function pointSize(schema) {
    return schema.reduce((size, dimension) => size + dimension.size, 0)
}
