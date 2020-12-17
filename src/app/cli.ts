#!/usr/bin/env node
import yargs from 'yargs'

import { Server } from '3d-tiles'

function parseOrigins(o?: string): Server.Origins {
  if (!o) return []
  if (o === '*') return '*'
  return o.split(',')
}

export const Cli = { run }
function run() {
  return yargs
    .demandCommand()
    .strict()
    .help()
    .command(
      'serve [root]',
      'Serve 3D Tiles on the fly from EPT resources',
      (yargs) =>
        yargs
          .option('root', {
            describe: 'EPT project directory to serve',
            default: '.',
            type: 'string',
          })
          .option('port', {
            alias: 'p',
            describe: 'Server port',
            default: 3000,
            type: 'number',
          })
          .option('origins', {
            describe: 'Access-Control-Allow-Origin list',
            type: 'string',
          })
          .option('keyfile', { describe: 'SSL key file', type: 'string' })
          .option('certfile', { describe: 'SSL cert file', type: 'string' })
          .option('cafile', { describe: 'SSL CA file', type: 'string' }),
      ({ origins: userOrigins, ...options }) => {
        const origins = parseOrigins(userOrigins)
        return Server.create({ origins, ...options })
      }
    )
    .parse()
}
