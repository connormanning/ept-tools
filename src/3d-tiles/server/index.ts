import Koa from 'koa'
import logger from 'koa-logger'
import Router from '@koa/router'
import { join } from 'protopath'

import { Options, translate } from '3d-tiles'

import { Cors } from './cors'
import { Httpx } from './httpx'
import { Ssl } from './ssl'
import { EptToolsError } from 'types'

export declare namespace Server {
  export type Origins = '*' | string[]
  export type Options = {
    root: string
    port: number
    origins: Origins
  } & Partial<Ssl.Options>
}
export const Server = { create }

async function create({
  root,
  port,
  origins,
  keyfile,
  certfile,
  cafile,
}: Server.Options) {
  const app = new Koa()
  app.use(logger())
  app.use(Cors.create(origins))

  const router = new Router()
  router.get('/:resource*/ept-tileset/:filename+', async (ctx) => {
    const { resource = '', filename } = ctx.params
    const fullPath = join(root, resource, 'ept-tileset', filename)
    const options = parseOptions(ctx.query)
    ctx.body = await translate(fullPath, options)
  })
  app.use(router.routes())
  app.use(router.allowedMethods())

  const ssl = Ssl.maybeCreate({ keyfile, certfile, cafile })
  const server = await Httpx.create(app, port, ssl)

  console.log(`Root: ${root}`)
  console.log(`Port: ${port}`)
  console.log(`Allowed origins: ${origins}`)
  if (ssl) console.log('Using SSL')

  async function destroy() {
    await new Promise((resolve) => server.close(resolve))
  }

  return { destroy }
}

function parseOptions(q: { [key: string]: string | undefined }) {
  const options: Partial<Options> = {}

  const { 'z-offset': zOffset, dimensions: dimstring } = q
  if (typeof zOffset === 'string') {
    options.zOffset = parseFloat(zOffset)
    if (Number.isNaN(options.zOffset)) {
      throw new EptToolsError(`Invalid Z-offset: ${zOffset}`)
    }
  }

  if (typeof dimstring === 'string') {
    options.dimensions = dimstring.split(',').map((s) => s.trim())
  }

  return options
}
