import Pool from 'p-limit'
import util from 'util'
import yargs from 'yargs'

import * as Cesium from './cesium'
import * as Util from './util'

const { input, threads = 8 } = yargs.argv
const { output = Util.protojoin(input, 'cesium') } = yargs.argv

if (Util.getProtocol(input)) throw new Error('Only local paths supported')

console.log('Translating to 3D Tiles:', input, '->', output)

async function translateMetadata(input, output) {
    const root = Util.join(input, 'ept-hierarchy')
    const files = (await Util.readDirAsync(root))
        .map(v => v == '0-0-0-0.json' ? 'tileset.json' : v)

    const pool = Pool(threads)
    const tasks = files.map(file => pool(async () => {
        console.log(file)
        const tileset = await Cesium.translate(Util.join(input, file))
        await Util.writeFileAsync(
            Util.join(output, file),
            JSON.stringify(tileset)
        )
    }))

    return Promise.all(tasks)
}

async function translatePoints(input, output) {
    const root = Util.join(input, 'ept-data')
    const files = (await Util.readDirAsync(root))
        .map(v => v.split('.')[0])
        .map(v => v + '.pnts')

    console.log('Files:', files)

    const pool = Pool(threads)
    const tasks = files.map(file => pool(async () => {
        console.log(file)
        const pnts = await Cesium.translate(Util.join(input, file))
        await Util.writeFileAsync(Util.join(output, file), pnts)
    }))

    return Promise.all(tasks)
}

;(async () => {
    try {
        await Util.mkdirpAsync(output)

        console.log('Translating metadata...')
        console.time('Metadata')
        await translateMetadata(input, output)
        console.timeEnd('Metadata')

        console.log('Translating points')
        console.time('Points')
        await translatePoints(input, output)
        console.timeEnd('Points')
    }
    catch (e) {
        console.log('Error:', e)
    }
})()
