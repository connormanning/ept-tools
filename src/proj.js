import proj4 from 'proj4'

// Register UTM definitions with Proj4.

const getDef = (zone, north, ellps, datum) => {
    const pre = ['+proj=utm', `+zone=${zone}`]
    const ns = north ? [] : ['+south']
    const post = [`+ellps=${ellps}`, `+datum=${datum}`, '+units=m', '+no_defs']
    return pre.concat(ns).concat(post).join(' ')
}

const vertWgs84 = (zone, north) => {
    const nsid = north ? 6 : 7
    const codenum = zone.toString().padStart(2, '0')
    const code = `EPSG:32${nsid}${codenum}`
    const def = getDef(zone, north, 'WGS84', 'WGS84')
    return [code, def]
}

const vertNad83 = (zone) => {
    const codenum = zone.toString().padStart(2, '0')
    const code = `EPSG:269${codenum}`
    const def = getDef(zone, true, 'GRS80', 'NAD83')
    return [code, def]
}

const registerDef = (code, def) => {
    proj4.defs(code, def)
    proj4.defs(`${code}+4326`, def)
}

for (let north = 0; north < 2; ++north) {
    for (let zone = 1; zone <= 60; ++zone) {
        const [code, def] = vertWgs84(zone, north)
        registerDef(code, def)

        if (north && zone >= 10 && zone < 20) {
            const [code, def] = vertNad83(zone)
            registerDef(code, def)
        }
    }
}

proj4.defs['EPSG:28992'] = '+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs'

// GDA94/Australian Albers
proj4.defs['EPSG:3577'] = '+proj=aea +lat_1=-18 +lat_2=-36 +lat_0=0 +lon_0=132 +x_0=0 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs '

// GDA94/MGA zones - these should really be wrapped into a function like UTM...
proj4.defs['EPSG:28355'] = '+proj=utm +zone=55 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'

proj4.defs['EPSG:28354'] = '+proj=utm +zone=54 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'

const wgs84 = { radius: 6378137, flattening: 1 / 298.257223563 }
const e2 = (2 - wgs84.flattening) * wgs84.flattening

function wgs84ToEcef([lon, lat, h]) {
    h = h || 0
    const rlat = lat / 180 * Math.PI
    const rlon = lon / 180 * Math.PI

    const slat = Math.sin(rlat)
    const clat = Math.cos(rlat)

    const N = wgs84.radius / Math.sqrt(1 - e2 * slat * slat)

    const x = (N + h) * clat * Math.cos(rlon)
    const y = (N + h) * clat * Math.sin(rlon)
    const z = (N * (1 - e2) + h) * slat
    return [x, y, z]
}

export function isEcef(from) { return from === 'EPSG:4978' }
export function isWgs84(from) { return from === 'EPSG:4326' }

export function wgs84Converter(from) {
    if (isEcef(from)) throw new Error('No conversion from ECEF->WGS84')
    if (isWgs84(from)) return p => p

    const native = proj4.defs(from)
    if (!native) throw new Error('Could not look up SRS: ' + from)
    const convert = proj4(native, proj4.defs('EPSG:4326'))

    return p => [...convert.forward(p.slice(0, 2)), p[2]]
}

export function ecefConverter(from) {
    if (isEcef(from)) return p => p
    if (isWgs84(from)) return wgs84ToEcef

    // For other data, we'll transit through WGS84.
    const native = proj4.defs(from)
    if (!native) throw new Error('Could not look up SRS: ' + from)
    const nativeToWgs84 = proj4(native, proj4.defs('EPSG:4326'))
    return p => [...nativeToWgs84.forward(p.slice(0, 2)), p[2]] |> wgs84ToEcef
}
