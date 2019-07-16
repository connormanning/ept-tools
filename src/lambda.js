import http from 'http'

import * as Cesium from './cesium'
import * as Util from './util'

const root = process.env.ROOT

export async function handler(event, context) {
    const file = event.file || process.env.FILE
    console.log('Event:', event)
    console.log('Context:', context)
    console.log('Root:', root)
    console.log('File:', file)

    const filename = Util.protojoin(root, file)
    console.log('Filename:', filename)
    const basename = Util.basename(filename)
    console.log('Basename:', basename)
    const [filebase, extension] = basename.split('.')
    console.log('Extension:', extension)

    console.time('Translation')
    const start = new Date()
    const body = await Cesium.translate(filename)
    console.timeEnd('Translation')
    console.log('Translated:', body)

    if (Buffer.isBuffer(body)) {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/octet-stream'
            },
            body: body.toString('base64'),
            isBase64Encoded: true
        }
    }
    else {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        }
    }
}
