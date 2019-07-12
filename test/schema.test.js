import * as Schema from '../src/schema'

const x = { name: 'X', type: 'double', size: 8 }
const y = { name: 'Y', type: 'signed', size: 4, scale: 0.01, offset: 100 }
const z = { name: 'Z', type: 'signed', size: 4, scale: 0.0025, offset: 25 }
const i = { name: 'Int16', type: 'signed', size: 2 }
const j = { name: 'UInt8', type: 'unsigned', size: 1 }
const g = { name: 'GpsTime', type: 'signed', size: 8, scale: 0.00001 }

const schema = [x, y, z, i, j, g]

test('find dimension', () => {
    expect(Schema.find(schema, 'X')).toEqual(x)
    expect(Schema.find(schema, 'Y')).toEqual(y)
    expect(Schema.find(schema, 'Z')).toEqual(z)
    expect(Schema.find(schema, 'Int16')).toEqual(i)
    expect(Schema.find(schema, 'UInt8')).toEqual(j)
    expect(Schema.find(schema, 'GpsTime')).toEqual(g)
    expect(Schema.find(schema, 'x')).toEqual(undefined)
})

test('has dimension', () => {
    expect(Schema.has(schema, 'X')).toBeTruthy()
    expect(Schema.has(schema, 'x')).toBeFalsy()
})

test('find dimension offset', () => {
    expect(Schema.offset(schema, 'X')).toBe(0)
    expect(Schema.offset(schema, 'Y')).toBe(8)
    expect(Schema.offset(schema, 'Z')).toBe(12)
    expect(Schema.offset(schema, 'Int16')).toBe(16)
    expect(Schema.offset(schema, 'UInt8')).toBe(18)
    expect(Schema.offset(schema, 'GpsTime')).toBe(19)
    expect(() => Schema.offset(schema, 'x')).toThrow()
})

test('find point size', () => {
    expect(Schema.pointSize(schema)).toBe(27)
})
