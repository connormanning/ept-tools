import { Ept, Hierarchy, JsonSchema } from 'ept'
import { Ellipsoid } from 'test'

const ept = { ...Ellipsoid.ept, dataType: 'laszip' }

test('valid ept', () => {
  const [result, errors] = JsonSchema.validate<Ept>(Ept.schema, ept)
  expect(result).toEqual(ept)
  expect(errors).toHaveLength(0)
})

test('missing data type', () => {
  const partial = Ellipsoid.ept // Note that this doesn't include dataType.
  const [result, errors] = JsonSchema.validate<Ept>(Ept.schema, partial)
  expect(result).toEqual(partial)
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatch('dataType')
})

test('valid hierarchy', () => {
  const hierarchy = { '0-0-0-0': 2, '1-0-0-0': -1 }
  const [result, errors] = JsonSchema.validate<Hierarchy>(
    Hierarchy.schema,
    hierarchy
  )
  expect(result).toEqual(hierarchy)
  expect(errors).toHaveLength(0)
})

test('invalid hierarchy', () => {
  const hierarchy = { '0-0-0-0': 2, '1-0-0-0': 'f' }
  const [result, errors] = JsonSchema.validate<Hierarchy>(
    Hierarchy.schema,
    hierarchy
  )
  expect(result).toEqual(hierarchy)
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatch('integer')
})
