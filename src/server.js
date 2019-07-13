import cors from 'cors'
import express from 'express'
import http from 'http'
import morgan from 'morgan'
import path from 'path'
import util from 'util'
import yargs from 'yargs'

import * as Translate from './translate'
import * as Util from './util'

process.title = 'ept-tools'

const {
    root = process.env.ROOT,
    port = process.env.PORT || 3000
} = yargs.argv

;(async () => {
    console.log('Root:', root)
    console.log('Port:', port)

    const app = express()
    app.use(cors())
    app.use(morgan('dev'))

    app.get('/:filename(*)', async (req, res) => {
        const { filename } = req.params

        try {
            const fullPath = Util.protojoin(root, filename)
            const body = await Translate.translate(fullPath)
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
    await listen(port)
    console.log('Listening')
})()
