import * as Dimension from '../dimension'

test('extract type string', () => {
    const ts = Dimension.typeString
    expect(ts({ type: 'float', size: 4 })).toEqual('float')
    expect(ts({ type: 'float', size: 8 })).toEqual('double')

    expect(ts({ type: 'signed', size: 1 })).toEqual('int8')
    expect(ts({ type: 'signed', size: 2 })).toEqual('int16')
    expect(ts({ type: 'signed', size: 4 })).toEqual('int32')
    expect(ts({ type: 'signed', size: 8 })).toEqual('int64')

    expect(ts({ type: 'unsigned', size: 1 })).toEqual('uint8')
    expect(ts({ type: 'unsigned', size: 2 })).toEqual('uint16')
    expect(ts({ type: 'unsigned', size: 4 })).toEqual('uint32')
    expect(ts({ type: 'unsigned', size: 8 })).toEqual('uint64')

    expect(() => ts({ type: 'float', size: 2 })).toThrow()
    expect(() => ts({ type: 'signed', size: 3 })).toThrow()
    expect(() => ts({ type: 'unsigned', size: 3 })).toThrow()
    expect(() => ts({ type: 'asdf', size: 4 })).toThrow()
    expect(() => ts({ type: 'float' })).toThrow()
    expect(() => ts({ size: 2 })).toThrow()
})
