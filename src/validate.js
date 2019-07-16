import Ajv from 'ajv'

import * as Bounds from './bounds'
import * as JsonSchema from './json-schema'
import * as Util from './util'

const ajv = new Ajv()

export function validateJsonSchema(schema, value) {
    const validate = ajv.compile(schema)
    const valid = validate(value)
    const errors = valid ? [] : validate.errors.reduce((errors, v) => {
        const prefix = schema.key || v.dataPath.slice(1)
        return errors.concat((prefix.length ? `${prefix}: ` : '') + v.message)
    }, [])
    return { valid, errors }
}

export function validateEpt(ept) {
    const { valid, errors } = validateJsonSchema(JsonSchema.ept, ept)
    if (!valid) return { valid, errors }

    const warnings = []

    const {
        bounds,
        boundsConforming,
        dataType,
        hierarchyType,
        points,
        schema,
        span,
        srs,
        version,
    } = ept

    if (!Bounds.containsBounds(bounds, boundsConforming)) {
        return {
            valid: false,
            errors: ['boundsConforming: is not contained by "bounds"']
        }
    }
    if (
        Bounds.width(bounds) != Bounds.depth(bounds) ||
        Bounds.width(bounds) != Bounds.height(bounds)
    ) {
        warnings.push('bounds: is not cubic')
    }

    if (Math.log2(span) % 1 !== 0) {
        warnings.push('span: is not a power of 2')
    }

    if (!srs.horizontal) {
        warnings.push(
            'srs: no "horizontal" code - interoperability will be limited'
        )
    }

    return { valid, errors, warnings }
}

export async function validate(input) {
    const ept = await Util.getJson(Util.protojoin(input, 'ept.json'))
    return validateEpt(ept)
}
