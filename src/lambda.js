import http from 'http'

import * as Translate from './translate'
import * as Util from './util'

const root = process.env.ROOT

export async function handler(event, context) {
    const path = event.path || process.env.FILE
    console.log('Env:', process.env)
    console.log('Path:', path)
    console.log('Event:', event)
    console.log('Context:', context)
    console.log('Root:', root)

    const filename = Util.protojoin(root, path)
    console.log('Filename:', filename)
    const basename = Util.basename(filename)
    console.log('Basename:', basename)
    const [filebase, extension] = basename.split('.')
    console.log('Extension:', extension)

    console.time('translate')
    const start = new Date()
    const body = await Translate.translate(filename)
    console.timeEnd('translate')
    console.log('Translated:', body)


    if (Buffer.isBuffer(body)) {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/octet-stream'
            },
            body: body.toString('base64')
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
