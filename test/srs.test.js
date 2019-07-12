import * as Srs from '../src/srs'

test('create', () => {
    const authority = 'EPSG'
    const horizontal = 26918
    const vertical = 4326

    expect(Srs.create()).toEqual({ })
    expect(Srs.create('EPSG')).toEqual({ })
    expect(Srs.create('EPSG:26918')).toEqual({ authority, horizontal })
    expect(Srs.create('EPSG:26918+4326'))
        .toEqual({ authority, horizontal, vertical })
})

test('code string', () => {
    expect(Srs.codeString()).toEqual(null)
    expect(Srs.codeString({ })).toEqual(null)
    expect(() => Srs.codeString({ authority: 'EPSG' })).toThrow()

    expect(Srs.codeString({
        authority: 'EPSG',
        horizontal: 3857
    })).toEqual('EPSG:3857')

    expect(Srs.codeString({
        authority: 'EPSG',
        horizontal: 3857
    })).toEqual('EPSG:3857')

    expect(Srs.codeString({
        authority: 'EPSG',
        horizontal: 3857,
        wkt: 'WKT'
    })).toEqual('EPSG:3857')

    expect(Srs.codeString({
        authority: 'EPSG',
        horizontal: 3857,
        vertical: 4326,
        wkt: 'WKT'
    })).toEqual('EPSG:3857+4326')

    expect(Srs.codeString({ wkt: 'WKT' })).toEqual(null)
})

test('stringify', () => {
    expect(Srs.stringify()).toEqual(null)
    expect(Srs.stringify({ })).toEqual(null)
    expect(() => Srs.stringify({ authority: 'EPSG' })).toThrow()

    expect(Srs.stringify({
        authority: 'EPSG',
        horizontal: 3857
    })).toEqual('EPSG:3857')

    expect(Srs.stringify({
        authority: 'EPSG',
        horizontal: 3857
    })).toEqual('EPSG:3857')

    expect(Srs.stringify({
        authority: 'EPSG',
        horizontal: 3857,
        wkt: 'WKT'
    })).toEqual('EPSG:3857')

    expect(Srs.stringify({
        authority: 'EPSG',
        horizontal: 3857,
        vertical: 4326,
        wkt: 'WKT'
    })).toEqual('EPSG:3857+4326')

    expect(Srs.stringify({ wkt: 'WKT' })).toEqual('WKT')
})
