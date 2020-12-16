import { Server } from 'http'
import Koa from 'koa'

const portBase = process.env.HTTP_PORT ? parseInt(process.env.HTTP_PORT) : 36363

// For each test suite that creates fake server, we grab a dedicated port so we
// can run all the tests in parallel without EADDRINUSE errors.
let portCount = 0
export function getPort() {
  return portBase + portCount++
}

export async function listen(app: Koa, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => resolve(server))
    app.on('error', reject)
  })
}
export async function destroy(server: Server) {
  await new Promise((resolve) => server.close(resolve))
}
