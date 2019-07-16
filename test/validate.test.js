import _ from 'lodash'

import * as Validate from '../src/validate'
import * as JsonSchema from '../src/json-schema'

const ept = {
    bounds: [481968, 4390186, 1493, 482856, 4391074, 2381],
    boundsConforming: [482060, 4390187, 1843, 482764, 4391072, 2030],
    dataType: 'laszip',
    hierarchyType: 'json',
    points: 4004326,
    schema: [
        { name: 'X', offset: 482412, scale: 0.01, size: 4, type: 'signed' },
        { name: 'Y', offset: 4390629, scale: 0.01, size: 4, type: 'signed' },
        { name: 'Z', offset: 1937, scale: 0.01, size: 4, type: 'signed' },
        { name: 'Intensity', size: 2, type: 'unsigned' },
        { name: 'ReturnNumber', size: 1, type: 'unsigned' },
        { name: 'NumberOfReturns', size: 1, type: 'unsigned' },
        { name: 'ScanDirectionFlag', size: 1, type: 'unsigned' },
        { name: 'EdgeOfFlightLine', size: 1, type: 'unsigned' },
        { name: 'Classification', size: 1, type: 'unsigned' },
        { name: 'ScanAngleRank', size: 4, type: 'float' },
        { name: 'UserData', size: 1, type: 'unsigned' },
        { name: 'PointSourceId', size: 2, type: 'unsigned' },
        { name: 'GpsTime', size: 8, type: 'float' },
        { name: 'Red', size: 2, type: 'unsigned' },
        { name: 'Green', size: 2, type: 'unsigned' },
        { name: 'Blue', size: 2, type: 'unsigned' },
        { name: 'OriginId', size: 4, type: 'unsigned' } ],
    span: 128,
    srs: {
        authority: 'EPSG',
        horizontal: '26913',
        wkt: 'PROJCS["NAD83 / UTM zone 13N", ... ]'
    },
    version: '1.0.0'
}

const validateOne = Validate.validateJsonSchema

function expectValid(schema, value) {
    expect(validateOne(schema, value).valid).toBe(true)
}

function expectOneError(schema, value, key) {
    const response = validateOne(schema, value)
    expect(response.valid).toBe(false)
    expect(response.errors).toHaveLength(1)
    if (key) expect(response.errors[0].startsWith(key)).toBe(true)
}

test('basic JSON schema validation', () => {
    const schema = { type: 'object', properties: { a: { type: 'string' } } }

    const good = validateOne(schema, { a: 'a' })
    expect(good.valid).toBe(true)

    expectOneError(schema, { a: 42 }, 'a')
})

test('bounds', () => {
    const good = validateOne(JsonSchema.bounds, [1, 2, 3, 4, 5, 6])
    expect(good.valid).toBe(true)

    expectOneError(JsonSchema.bounds, [1, 2, 3, 4, 5], 'bounds')
})

test('data type', () => {
    expect(validateOne(JsonSchema.dataType, 'binary').valid).toBe(true)
    expect(validateOne(JsonSchema.dataType, 'laszip').valid).toBe(true)
    expect(validateOne(JsonSchema.dataType, 'zstandard').valid).toBe(true)

    expectOneError(JsonSchema.dataType, 'Binary', 'dataType')
})

test('hierarchy type', () => {
    expect(validateOne(JsonSchema.hierarchyType, 'json').valid).toBe(true)


    expectOneError(JsonSchema.hierarchyType, 'Json', 'hierarchyType')
})

test('point count', () => {
    expect(validateOne(JsonSchema.points, 42).valid).toBe(true)

    expectOneError(JsonSchema.points, 'Json', 'points')
})

test('dimension', () => {
    // Valid dimensions.
    expectValid(JsonSchema.dimension, { name: 'X', type: 'signed', size: 1 })
    expectValid(JsonSchema.dimension, { name: 'X', type: 'signed', size: 2 })
    expectValid(JsonSchema.dimension, { name: 'X', type: 'signed', size: 4 })
    expectValid(JsonSchema.dimension, { name: 'X', type: 'signed', size: 8 })

    expectValid(JsonSchema.dimension, { name: 'X', type: 'unsigned', size: 1 })
    expectValid(JsonSchema.dimension, { name: 'X', type: 'unsigned', size: 2 })
    expectValid(JsonSchema.dimension, { name: 'X', type: 'unsigned', size: 4 })
    expectValid(JsonSchema.dimension, { name: 'X', type: 'unsigned', size: 8 })

    expectValid(JsonSchema.dimension, { name: 'X', type: 'float', size: 4 })
    expectValid(JsonSchema.dimension, { name: 'X', type: 'float', size: 8 })

    expectValid(
        JsonSchema.dimension,
        { name: 'X', type: 'float', size: 4, scale: 0.1 }
    )
    expectValid(
        JsonSchema.dimension,
        { name: 'X', type: 'float', size: 8, offset: 42 }
    )
    expectValid(JsonSchema.dimension, {
        name: 'X',
        type: 'float',
        size: 8,
        scale: 0.1,
        offset: -42
    })

    // Missing required fields.
    expectOneError(JsonSchema.dimension, { type: 'signed', size: 2 })
    expectOneError(JsonSchema.dimension, { name: 'X', size: 2 })
    expectOneError(JsonSchema.dimension, { name: 'X', type: 'signed' })

    // Invalid required fields.
    expectOneError(JsonSchema.dimension, {
        name: 42,   // Invalid.
        type: 'signed',
        size: 8
    })
    expectOneError(JsonSchema.dimension, {
        name: 'X',
        type: 'Signed', // Invalid.
        size: 2
    })
    expectOneError(JsonSchema.dimension, {
        name: 'X',
        type: 'signed',
        size: 16    // Invalid.
    })
    expectOneError(JsonSchema.dimension, {
        name: 'X',
        type: 'float',
        size: 2 // Invalid in combination with type "float".
    })
    expectOneError(JsonSchema.dimension, {
        name: 'X',
        type: 'float',
        size: '4'   // Invalid.
    })
    expectOneError(JsonSchema.dimension, {
        name: 'X',
        type: 'float',
        size: 0 // Invalid.
    })

    // Invalid optional fields.
    expectOneError(JsonSchema.dimension, {
        name: 'X',
        type: 'signed',
        size: 2,
        scale: 'a', // Invalid.
        offset: 0
    })
    expectOneError(JsonSchema.dimension, {
        name: 'X',
        type: 'signed',
        size: 2,
        scale: 0,   // Invalid.
        offset: 0
    })
    expectOneError(JsonSchema.dimension, {
        name: 'X',
        type: 'signed',
        size: 2,
        scale: -1,  // Invalid.
        offset: 0
    })
    expectOneError(JsonSchema.dimension, {
        name: 'X',
        type: 'signed',
        size: 2,
        scale: 1,
        offset: 'a' // Invalid.
    })
})

test('schema', () => {
    expectValid(JsonSchema.schema, [{ name: 'X', type: 'signed', size: 1 }])

    expectOneError(JsonSchema.schema, 42, 'schema')
    expectOneError(JsonSchema.schema, [], 'schema')
    expectOneError(
        JsonSchema.schema,
        [{ name: 'X', type: 'asdf', size: 1 }],
        'schema'
    )
})

test('span', () => {
    expectValid(JsonSchema.span, 64)
    expectValid(JsonSchema.span, 128)

    expectOneError(JsonSchema.span, 0, 'span')
    expectOneError(JsonSchema.span, -1, 'span')
    expectOneError(JsonSchema.span, undefined, 'span')
})

test('srs', () => {
    const authority = 'EPSG'
    const horizontal = '26918'
    const vertical = '4326'
    const wkt = 'Some WKT string'

    expectValid(JsonSchema.srs, { })
    expectValid(JsonSchema.srs, { authority, horizontal })
    expectValid(JsonSchema.srs, { authority, horizontal, wkt })
    expectValid(JsonSchema.srs, { authority, horizontal, vertical })
    expectValid(JsonSchema.srs, { authority, horizontal, vertical, wkt })
    expectValid(JsonSchema.srs, { wkt })

    expectOneError(JsonSchema.srs, { authority }, 'srs')
    expectOneError(JsonSchema.srs, { horizontal }, 'srs')
    expectOneError(JsonSchema.srs, { horizontal, wkt }, 'srs')
    expectOneError(JsonSchema.srs, { vertical }, 'srs')
    expectOneError(JsonSchema.srs, { vertical, wkt }, 'srs')
    expectOneError(JsonSchema.srs, { authority, vertical }, 'srs')
    expectOneError(JsonSchema.srs, { authority, wkt }, 'srs')
})

test('version', () => {
    expectValid(JsonSchema.version, '1.0.0')

    expectOneError(JsonSchema.version, '1.0.1')
    expectOneError(JsonSchema.version, '')
})

test('full EPT metadata file', () => {
    const { valid, errors, warnings } = Validate.validateEpt(ept)
    expect(valid).toBe(true)
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
})

test('boundsConforming larger than bounds', () => {
    const { valid, errors } = Validate.validateEpt(
        _.assign(
            _.cloneDeep(ept),
            {
                'boundsConforming': ept.bounds.map((v, i) =>
                    i == 4 ? v + 1 : v
                )
            }
        )
    )
    expect(valid).toBe(false)
    expect(errors).toHaveLength(1)
    expect(errors[0].startsWith('boundsConforming')).toBe(true)
})

test('warns for lack of SRS code', () => {
    const { valid, errors, warnings } = Validate.validateEpt(
        _.assign(_.cloneDeep(ept), { srs: { } })
    )
    expect(valid).toBe(true)
    expect(errors).toEqual([])
    expect(warnings).toHaveLength(1)
    expect(warnings[0].startsWith('srs')).toBe(true)
})
