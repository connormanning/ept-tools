import { Server } from 'http'
import Koa from 'koa'

export const port = process.env.HTTP_PORT
  ? parseInt(process.env.HTTP_PORT)
  : 36363

export async function listen(app: Koa): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => resolve(server))
    app.on('error', reject)
  })
}
export async function destroy(server: Server) {
  await new Promise((resolve) => server.close(resolve))
}
