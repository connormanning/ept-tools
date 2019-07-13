import * as Binary from '../src/binary'
import * as Schema from '../src/schema'

test('writes and extracts values according to a schema', () => {
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

    const writeA = Binary.getWriter(schema, 'A')
    const writeB = Binary.getWriter(schema, 'B')
    const writeC = Binary.getWriter(schema, 'C')

    for (let i = 0; i < points; ++i) {
        writeA(buffer, 100 + i, i)
        writeB(buffer, 200 + i, i)
        writeC(buffer, 300 + i, i)
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
