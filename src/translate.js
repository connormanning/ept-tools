import Pool from 'p-limit'
import util from 'util'
import yargs from 'yargs'

import * as Cesium from './cesium'
import * as Util from './util'

async function translateMetadata({ input, output, threads }) {
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

async function translatePoints({ input, output, threads }) {
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

export async function translate({ input, output, threads, force }) {
    if (
        !force &&
        await Util.fileExistsAsync(Util.join(output, 'tileset.json'))
    ) {
        throw new Error('Output already exists - use --force to overwrite')
    }

    await Util.mkdirpAsync(output)

    console.log('Translating metadata...')
    console.time('Metadata')
    await translateMetadata({ input, output, threads })
    console.timeEnd('Metadata')

    console.log('Translating points')
    console.time('Points')
    await translatePoints({ input, output, threads })
    console.timeEnd('Points')
}
