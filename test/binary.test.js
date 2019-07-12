import * as Binary from '../binary'
import * as Schema from '../schema'

test('extracts values', () => {
    const points = 10
    const scaleC = 0.01
    const offsetC = 42
    const schema = [
        { name: 'A', type: 'float', size: 8 },
        { name: 'B', type: 'float', size: 4 },
        { name: 'C', type: 'signed', size: 2, scale: scaleC, offset: offsetC }
    ]
    const pointSize = Schema.pointSize(schema)
    const buffer = Buffer.alloc(points * pointSize)

    for (let i = 0; i < points; ++i) {
        buffer.writeDoubleLE(100 + i, i * pointSize)
        buffer.writeFloatLE(200 + i, i * pointSize + 8)
        buffer.writeInt16LE(((300 + i) - offsetC) / scaleC, i * pointSize + 12)
    }

    const extractA = Binary.getExtractor(schema, 'A')
    const extractB = Binary.getExtractor(schema, 'B')
    const extractC = Binary.getExtractor(schema, 'C')

    for (let i = 0; i < points; ++i) {
        expect(extractA(buffer, i)).toBe(100 + i)
        expect(extractB(buffer, i)).toBe(200 + i)
        expect(extractC(buffer, i)).toBe(300 + i)
    }
    expect.assertions(points * schema.length)
})

test('throws for non-existent dimensions', () => {
    const schema = [{ name: 'X', type: 'double', size: 8 }]
    expect(() => Binary.getExtractor(schema, 'Y')).toThrow()
})
