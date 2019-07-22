import cors from 'cors'
import express from 'express'
import http from 'http'
import morgan from 'morgan'
import path from 'path'
import util from 'util'

import * as Cesium from './cesium'
import * as Util from './util'

export async function serve({ root, port }) {
    const app = express()
    app.use(cors())
    app.use(morgan('dev', { skip: (req, res) => res.statusCode < 400 }))

    app.get('/:resource(*)/ept-tileset/:filename(*)', async (req, res) => {
        const { resource, filename } = req.params

        try {
            const fullPath = Util.protojoin(
                root,
                resource,
                'ept-tileset',
                filename
            )
            const body = await Cesium.translate(fullPath)
            return res.send(body)
        }
        catch (e) {
            return res
                .status(e.statusCode || 500)
                .send(e.message || 'Unknown error')
        }
    })

    const server = http.createServer(app)
    const listen = util.promisify(server.listen.bind(server))
    return listen(port)
}
