import fs from 'fs'
import http from 'http'
import https from 'https'
import Koa from 'koa'

import { Ssl } from './ssl'

export const Httpx = { create }
async function create(
  app: Koa,
  port: number,
  ssl?: Ssl.Options
): Promise<http.Server> {
  if (ssl) {
    const { keyPath, certPath, caPath } = ssl
    const options = {
      key: await read(keyPath),
      cert: await read(certPath),
      ca: caPath ? await read(caPath) : undefined,
    }

    return new Promise<https.Server>((resolve, reject) => {
      const server = https
        .createServer(options, app.callback())
        .listen(port, () => resolve(server))
        .on('error', reject)
    })
  }

  return new Promise<http.Server>((resolve, reject) => {
    const server = http
      .createServer(app.callback())
      .listen(port, () => resolve(server))
      .on('error', reject)
  })
}

async function read(path: string) {
  return fs.promises.readFile(path, { encoding: 'utf8' })
}
