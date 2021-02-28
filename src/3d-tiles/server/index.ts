import Koa from 'koa'
import logger from 'koa-logger'
import Router from '@koa/router'
import { join } from 'protopath'

import { Cache, translate } from '3d-tiles'

import { Cors } from './cors'
import { Httpx } from './httpx'
import { Ssl } from './ssl'
import { parseQuery } from './utils'

export { parseQuery }

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

  const cache = Cache.create()
  const router = new Router()

  router.get('/:resource*/ept-tileset/:subpath+', async (ctx) => {
    const { resource = '', subpath } = ctx.params
    const filename = join(root, resource, 'ept-tileset', subpath)
    const options = parseQuery(ctx.query)
    ctx.body = await translate({ filename, options, cache })
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
