import Koa from 'koa'
import logger from 'koa-logger'
import Router from '@koa/router'
import { join, normalize } from 'protopath'

import { Cache, translate } from '3d-tiles'
import { HttpError } from 'types'

import { Cors } from './cors'
import { Httpx } from './httpx'
import { Ssl } from './ssl'
import { parseQuery } from './utils'

export { parseQuery }

export declare namespace Server {
  export type Origins = '*' | string[]
  export type Options = {
    root?: string
    roots: Origins
    port: number
    origins: Origins
  } & Partial<Ssl.Options>
}
export const Server = { create }

async function create({
  root,
  roots,
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

  if (root) {
    console.log('Root:', root)
    router.get('/:resource*/ept-tileset/:subpath+', async (ctx) => {
      const { resource = '', subpath } = ctx.params
      const filename = join(root, resource, 'ept-tileset', subpath)
      const options = parseQuery(ctx.query)
      ctx.body = await translate({ filename, options, cache })
    })
  } else if (roots) {
    if (roots === '*' || roots.length === 1) console.log('Roots:', roots)
    else {
      console.log('Roots:')
      roots.forEach(root => console.log(`    ${root}`))
    }
    router.get('/roots', async (ctx) => (ctx.body = { roots }))

    router.get('/:subpath+', async (ctx) => {
      const { subpath } = ctx.params
      const options = parseQuery(ctx.query)

      if (typeof options.ept !== 'string') {
        throw new HttpError(400, 'Missing required "ept" parameter')
      }

      const ept = normalize(options.ept)

      if (!ept.endsWith('/ept.json')) {
        throw new HttpError(400, 'Invalid EPT path - must end with "/ept.json"')
      }

      if (roots !== '*' && !roots.some((v) => ept.startsWith(`${v}/`))) {
        throw new HttpError(
          403,
          `This EPT path is not contained in the allowed roots`
        )
      }

      const filename = join(ept, '..', 'ept-tileset', subpath)
      ctx.body = await translate({ filename, options, cache })
    })
  }

  app.use(async (ctx, next) => {
    try {
      await next()
    } catch (err) {
      ctx.body = { message: err.message || 'Unknown error' }
      ctx.status = err.statusCode || 500
    }
  })

  app.use(router.routes())
  app.use(router.allowedMethods())

  const ssl = Ssl.maybeCreate({ keyfile, certfile, cafile })
  const server = await Httpx.create(app, port, ssl)

  console.log(`Port: ${port}`)
  console.log(`Allowed origins: ${origins}`)
  if (ssl) console.log('Using SSL')

  async function destroy() {
    await new Promise((resolve) => server.close(resolve))
  }

  return { destroy }
}
