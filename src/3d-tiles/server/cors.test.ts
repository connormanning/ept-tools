import Koa from 'koa'
import fetch from 'node-fetch'

import { Server } from 'test'

import { Cors } from './cors'

const port = Server.getPort(1)
const url = `http://localhost:${port}`
async function getOrigin(url: string, headers?: { [key: string]: string }) {
  const res = await fetch(url, { headers })
  return res.headers.get('access-control-allow-origin') || undefined
}

test('access control allow origin: none', async () => {
  const app = new Koa()
  app.use(Cors.create())
  app.use((ctx) => (ctx.body = 'asdf'))

  const server = await Server.listen(app, port)

  try {
    // No access control allow origin header in any responses.
    expect(await getOrigin(url)).toBeUndefined()
    expect(
      await getOrigin(url, { origin: 'https://entwine.io' })
    ).toBeUndefined()
  } finally {
    await Server.destroy(server)
  }
})

test('access control allow origin: *', async () => {
  const app = new Koa()
  app.use(Cors.create('*'))
  app.use((ctx) => (ctx.body = 'asdf'))

  const server = await Server.listen(app, port)

  try {
    // If the request does not contain an explicit origin, we should get a "*"".
    expect(await getOrigin(url)).toEqual('*')

    // With an origin set in the request, the response should be set to that
    // origin.
    expect(await getOrigin(url, { origin: 'https://entwine.io' })).toEqual(
      'https://entwine.io'
    )
  } finally {
    await Server.destroy(server)
  }
})

test('access control allow origin: single origin', async () => {
  const app = new Koa()
  app.use(Cors.create(['https://entwine.io']))
  app.use((ctx) => (ctx.body = 'asdf'))

  const server = await Server.listen(app, port)

  try {
    // If the request doesn't contain an origin, we should get our single
    // allowed origin.
    expect(await getOrigin(url)).toEqual('https://entwine.io')

    // If the request contains an origin, we should get that origin whether it
    // matches or not.
    expect(await getOrigin(url, { origin: 'https://entwine.io' })).toEqual(
      'https://entwine.io'
    )
    expect(await getOrigin(url, { origin: 'https://pdal.io' })).toEqual(
      'https://entwine.io'
    )
  } finally {
    await Server.destroy(server)
  }
})

test('access control allow origin: multiple origins', async () => {
  const app = new Koa()
  app.use(Cors.create(['https://entwine.io', 'https://pdal.io']))
  app.use((ctx) => (ctx.body = 'asdf'))

  const server = await Server.listen(app, port)

  try {
    // If the request doesn't contain an origin, we should get no header.
    expect(await getOrigin(url)).toBeUndefined()

    // If the request contains an origin in our list, it should be reflected.
    expect(await getOrigin(url, { origin: 'https://entwine.io' })).toEqual(
      'https://entwine.io'
    )
    expect(await getOrigin(url, { origin: 'https://pdal.io' })).toEqual(
      'https://pdal.io'
    )

    // And if the request contains an origin *not* in our list, we should get no
    // header.
    expect(await getOrigin(url, { origin: 'https://asdf.io' })).toBeUndefined()
  } finally {
    await Server.destroy(server)
  }
})
