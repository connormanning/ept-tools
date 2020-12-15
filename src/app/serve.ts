import { Server } from '../3d-tiles/server'

export const Serve = { run }
async function run(options: Server.Options) {
  return Server.create(options)
}
