#!/usr/bin/env node
import yargs from 'yargs'

import { Serve } from './serve'

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
          .option('allowed-origins', {
            describe: 'Access-Control-Allow-Origin list',
            default: '*',
            type: 'string',
          })
          .option('key-path', { describe: 'SSL key path', type: 'string' })
          .option('cert-path', { describe: 'SSL cert path', type: 'string' })
          .option('ca-path', { describe: 'SSL CA path', type: 'string' }),
      // Pending https://github.com/yargs/yargs/issues/1679, we could replace
      // the below with simply "Serve.run".  For now we need to translate kebab
      // to camel.
      ({
        'allowed-origins': allowedOrigins,
        'key-path': keyPath,
        'cert-path': certPath,
        'ca-path': caPath,
        ...options
      }) => {
        return Serve.run({
          allowedOrigins,
          keyPath,
          certPath,
          caPath,
          ...options,
        })
      }
    )
    .parse()
}
