import * as Proj from '../src/proj'

// These are the exact native coordinates of the synthetic ellipsoid data.
// The verification coordinates are all derived from reprojections of these.
const webMercatorCode = 'EPSG:3857'
const nycWebMercator = [-8242596, 4966606, 0]

const nycUtmCode = 'EPSG:26918'
const nycUtm = [580735.9001774283, 4504694.970845929, 0]

const wgs84Code = 'EPSG:4326'
const nycWgs84 = [-74.0444996762243, 40.68919824733844, 0]

const ecefCode = 'EPSG:4978'
const nycEcef = [1331340.714375315, -4656583.46257742, 4136313.2510571736]

const magnitude = xyz => Math.sqrt(xyz.reduce((p, c) => p + c * c, 0))

function expectCloseArray(a, b, digits) {
    if (a.length != b.length) throw new Error('Invalid lengths')
    for (let i = 0; i < a.length; ++i) {
        expect(a[i]).toBeCloseTo(b[i], digits)
    }
}

test('magnitudes WGS84', () => {
    const wgs84ToEcef = Proj.ecefConverter(wgs84Code)
    const min = nycWgs84.slice(0, 2).concat(-50)
    const max = nycWgs84.slice(0, 2).concat(50)

    const ecefMin = wgs84ToEcef(min)
    const ecefMax = wgs84ToEcef(max)

    expect(magnitude(ecefMax) - magnitude(ecefMin)).toBeCloseTo(100)
})

test('magnitudes UTM', () => {
    const utmToEcef = Proj.ecefConverter(nycUtmCode)
    const min = nycUtm.slice(0, 2).concat(-50)
    const max = nycUtm.slice(0, 2).concat(50)

    const ecefMin = utmToEcef(min)
    const ecefMax = utmToEcef(max)

    expect(magnitude(ecefMax) - magnitude(ecefMin)).toBeCloseTo(100)
})

test('determine WGS84/ECEF', () => {
    expect(Proj.isWgs84(wgs84Code)).toBe(true)
    expect(Proj.isWgs84(ecefCode)).toBe(false)

    expect(Proj.isEcef(wgs84Code)).toBe(false)
    expect(Proj.isEcef(ecefCode)).toBe(true)
})

test('to WGS84', () => {
    const fromWebMercator = Proj.wgs84Converter(webMercatorCode)(nycWebMercator)
    expectCloseArray(fromWebMercator, nycWgs84, 7)

    const fromUtm = Proj.wgs84Converter(nycUtmCode)(nycUtm)
    expectCloseArray(fromUtm, nycWgs84, 7)

    // No-op.
    const fromWgs84 = Proj.wgs84Converter(wgs84Code)(nycWgs84)
    expect(fromWgs84).toEqual(nycWgs84)

    expect(() => Proj.wgs84Converter(ecefCode)).toThrow()

    const up = nycWebMercator.slice(0, 2).concat(1)
    const fromUp = Proj.wgs84Converter(webMercatorCode)(up)
    expectCloseArray(fromUp, nycWgs84.slice(0, 2).concat(1), 7)
})

test('to ECEF', () => {
    const fromWebMercator = Proj.ecefConverter(webMercatorCode)(nycWebMercator)
    expectCloseArray(fromWebMercator, nycEcef, 7)

    const fromUtm = Proj.ecefConverter(nycUtmCode)(nycUtm)
    expectCloseArray(fromUtm, nycEcef, 7)

    const fromWgs84 = Proj.ecefConverter(wgs84Code)(nycWgs84)
    expectCloseArray(fromWgs84, nycEcef, 7)

    // No-op.
    const fromEcef = Proj.ecefConverter(ecefCode)(nycEcef)
    expect(fromEcef).toEqual(nycEcef)
})
