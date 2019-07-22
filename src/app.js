#!/usr/bin/env node

import chalk from 'chalk'
import symbols from 'log-symbols'
import yargs from 'yargs'

import * as Server from './server'
import * as Translate from './translate'
import * as Util from './util'
import * as Validate from './validate'

async function validate({ input }) {
    if (input.endsWith('ept.json')) input = Util.join(input, '..')
    console.log(`Validating ${input}/`)
    const { valid, errors, warnings } = await Validate.validate(input)

    console.log()
    if (!valid) {
        console.log(symbols.error, 'Errors:')
        errors.forEach(v => console.log(`\t• ${v}`))
        console.log()

        console.log(symbols.error, 'EPT is not valid')
        process.exit(1)
    }
    else {
        if (warnings.length) {
            console.log(chalk.yellow('!!'), 'Warnings:')
            warnings.forEach(v => console.log(`\t• ${v}`))
            console.log()
        }
        console.log(symbols.success, 'EPT appears to be valid')
    }
}

async function serve({ root, port }) {
    await Server.serve({ root, port })
    console.log('Serving', root, 'on port', port)
}

async function translate({
    input,
    output,
    threads,
    force,
}) {
    if (input.endsWith('ept.json')) input = Util.protojoin(input, '..')
    if (!output) output = Util.protojoin(input, 'ept-tileset')

    console.log('Translating:', input, '->', output)
    console.log('\tThreads:', threads)
    if (force) console.log('\tOverwriting output')
    await Translate.translate({ input, output, threads, force })
}

async function run(f, ...args) {
    try {
        await f(...args)
    }
    catch (e) {
        if (e.message) return console.error('Error:', e.message)
        console.log('Unknown error:', e)
        process.exit(1)
    }
}

yargs
    .version(false)
    .demandCommand()
    .strict()
    .help()
    .command(
        'validate [input]',
        'Validate EPT metadata',
        yargs => yargs
            .option('input', {
                alias: 'i',
                describe: 'EPT dataset root path',
                demandOption: true
            })
        ,
        args => run(validate, args)
    )
    .command(
        'serve [root]',
        'Serve 3D tiles on the fly from EPT resources',
        yargs => yargs
            .option('root', {
                alias: 'r',
                describe: 'EPT project directory to serve',
                default: '.',
            })
            .option('port', {
                alias: 'p',
                describe: 'Server port',
                default: 3000
            })
        ,
        args => run(serve, args)
    )
    .command(
        'tile [input]',
        'Translate EPT to 3D Tiles',
        yargs => yargs
            .option('input', {
                alias: 'i',
                describe: 'EPT dataset root path',
                demandOption: true
            })
            .option('output', {
                alias: 'o',
                describe: 'Tileset output path.  Default: <input>/ept-tileset'
            })
            .option('threads', {
                alias: 't',
                describe: 'Number of parallel threads for file conversion',
                default: 8
            })
            .option('force', {
                alias: 'f',
                type: 'boolean',
                describe: 'Overwrite existing output',
                default: false
            })
        ,
        args => run(translate, args)
    )
    .parse()
