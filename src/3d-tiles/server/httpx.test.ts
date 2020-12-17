import { Agent } from 'https'
import Koa from 'koa'
import fetch from 'node-fetch'

import { Server, keyfile, certfile, cafile } from 'test'

import { Httpx } from './httpx'

const port = Server.getPort(2)

test('http', async () => {
  const app = new Koa()
  app.use((ctx) => (ctx.body = 'asdf'))

  const url = `http://localhost:${port}`
  const server = await Httpx.create(app, port)

  try {
    const res = await fetch(url)
    expect(await res.text()).toEqual('asdf')
  } finally {
    await Server.destroy(server)
  }
})

test('https', async () => {
  const app = new Koa()
  app.use((ctx) => (ctx.body = 'asdf'))

  const url = `https://localhost:${port}`
  const server = await Httpx.create(app, port, { keyfile, certfile })

  try {
    const agent = new Agent({ rejectUnauthorized: false })
    const res = await fetch(url, { agent })
    expect(await res.text()).toEqual('asdf')
  } finally {
    await Server.destroy(server)
  }
})

test('with ca', async () => {
  const app = new Koa()
  app.use((ctx) => (ctx.body = 'asdf'))

  const url = `https://localhost:${port}`
  const server = await Httpx.create(app, port, { keyfile, certfile, cafile })

  try {
    const agent = new Agent({ rejectUnauthorized: false })
    const res = await fetch(url, { agent })
    expect(await res.text()).toEqual('asdf')
  } finally {
    await Server.destroy(server)
  }
})
