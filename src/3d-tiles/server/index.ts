import Koa from 'koa'
import logger from 'koa-logger'
import Router from '@koa/router'
import { join } from 'protopath'

import { translate } from '3d-tiles'

import { Cors } from './cors'
import { Httpx } from './httpx'
import { Ssl } from './ssl'

export declare namespace Server {
  export type Options = {
    root: string
    port: number
    allowedOrigins: string
  } & Partial<Ssl.Options>
}
export const Server = { create }

async function create({
  root,
  port,
  allowedOrigins,
  keyPath,
  certPath,
  caPath,
}: Server.Options) {
  const app = new Koa()
  app.use(logger())
  app.use(Cors.create(allowedOrigins))

  const router = new Router()
  router.get('/:resource*/ept-tileset/:filename+', async (ctx) => {
    const { resource = '', filename } = ctx.params
    const fullPath = join(root, resource, 'ept-tileset', filename)
    ctx.body = await translate(fullPath)
  })
  app.use(router.routes())
  app.use(router.allowedMethods())

  const ssl = Ssl.maybeCreate({ keyPath, certPath, caPath })
  const server = await Httpx.create(app, port, ssl)

  console.log(`Root: ${root}`)
  console.log(`Port: ${port}`)
  console.log(`Allowed origins: ${allowedOrigins}`)

  async function destroy() {
    await new Promise((resolve) => server.close(resolve))
  }

  return { destroy }
}
