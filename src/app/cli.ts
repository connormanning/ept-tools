#!/usr/bin/env node
import { basename, join } from 'protopath'
import yargs from 'yargs'

import { Server } from '3d-tiles'

import { tile } from './tile'
import { validate } from './validate'

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
      'validate [input]',
      'Validate EPT metadata',
      (yargs) =>
        yargs.option('input', {
          alias: 'i',
          type: 'string',
          describe: 'Path to ept.json file',
          demandOption: true,
        }),
      ({ input }) => {
        if (!input.endsWith('ept.json')) input = join(input, 'ept.json')
        return validate(input)
      }
    )
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
            default: '*',
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
    .command(
      'tile [input]',
      'Translate EPT to 3D Tiles at rest',
      (yargs) =>
        yargs
          .option('input', {
            describe: 'Path to ept.json file',
            alias: 'i',
            demandOption: true,
            type: 'string',
          })
          .option('output', {
            describe: 'Tileset output path',
            defaultDescription: '<input>/ept-tileset',
            alias: 'o',
            type: 'string',
          })
          .option('threads', {
            describe: 'Number of parallel threads',
            default: 8,
            alias: 't',
            type: 'number',
          })
          .option('force', {
            describe: 'Overwrite existing output, if present',
            default: false,
            alias: 'f',
            type: 'boolean',
          })
          .option('verbose', {
            describe: 'Enable verbose logs',
            default: false,
            alias: 'v',
            type: 'boolean',
          })
          .option('dimensions', {
            describe: 'Dimensions to be added to the batch table',
            type: 'string',
            array: true,
          })
          .option('z-offset', {
            describe:
              'Elevation offset to raise/lower the resulting point cloud',
            type: 'number',
          })
          .option('truncate', {
            describe: 'Truncate 16-bit colors to 8-bit',
            default: false,
            type: 'boolean',
          }),
      ({
        input,
        output,
        threads,
        force,
        verbose,
        dimensions,
        'z-offset': zOffset,
        truncate,
      }) => {
        // Get input/output as directories - they potentially point at files.
        if (basename(input) === 'ept.json') input = join(input, '..')
        if (!output) output = join(input, 'ept-tileset')
        if (basename(output) === 'tileset.json') output = join(output, '..')

        const options = { dimensions, zOffset, truncate }

        console.log(`Tiling: ${input} -> ${output}`)
        console.log('Threads:', threads)
        if (dimensions?.length)
          console.log('Dimensions:', dimensions.join(', '))
        if (zOffset) console.log('Z offset:', zOffset)
        if (truncate) console.log('Truncating RGB values')
        if (force) console.log('Overwriting output')
        return tile({ input, output, threads, force, verbose, options })
      }
    )
    .parse()
}
