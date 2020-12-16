import http from 'http'
import { join } from 'path'
import Koa, { Context } from 'koa'

import { Server } from 'test'

import { getBinary, getJson } from './get'

const port = Server.getPort()

const notafile = join(__dirname, 'test/i-do-not-exist.json')
const textfile = join(__dirname, 'test/data.txt')
const jsonfile = join(__dirname, 'test/data.json')

test('file: not found', async () => {
  await expect(getBinary(notafile)).rejects.toThrow('no such file')
})

test('file: good binary', async () => {
  expect((await getBinary(textfile)).toString()).toEqual('data')
})

test('file: bad json', async () => {
  await expect(getJson(textfile)).rejects.toThrow(/unexpected token/i)
})

test('file: good json', async () => {
  expect(await getJson(jsonfile)).toEqual({ data: 42 })
})

test('http: failure', async () => {
  const app = new Koa()
  app.use((ctx: Context) => (ctx.status = 412))
  const server = await Server.listen(app, port)

  try {
    await expect(getBinary(`http://localhost:${port}`)).rejects.toThrow(
      /precondition failed/i
    )
  } finally {
    await Server.destroy(server)
  }
})

test('http: success', async () => {
  const app = new Koa()
  app.use((ctx: Context) => (ctx.body = Buffer.from('asdf')))
  const server = await Server.listen(app, port)

  try {
    expect((await getBinary(`http://localhost:${port}`)).toString()).toEqual(
      'asdf'
    )
  } finally {
    await Server.destroy(server)
  }
})

test('http: success json', async () => {
  const app = new Koa()
  app.use((ctx: Context) => (ctx.body = { a: 1 }))
  const server = await Server.listen(app, port)

  try {
    expect(await getJson(`http://localhost:${port}`)).toEqual({ a: 1 })
  } finally {
    await Server.destroy(server)
  }
})
