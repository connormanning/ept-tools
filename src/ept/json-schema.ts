import Ajv, { Schema } from 'ajv'

const ajv = new Ajv()
export const JsonSchema = { validate }

export type Validation<T> = [T, string[]]
function validate<T>(schema: Schema, value: unknown): Validation<T> {
  if (typeof schema === 'boolean') throw new Error('Invalid JSON schema')

  const validate = ajv.compile(schema)
  const isValid = validate(value)
  const errors =
    isValid || !validate.errors
      ? []
      : validate.errors.map<string>((v) => {
          const prefix = schema.title || v.dataPath.slice(1)
          return (prefix.length ? `${prefix}: ` : '') + v.message
        })

  return [value as T, errors]
}
