#!/usr/bin/env node
import { Cli } from './cli'
export * as Lambda from './lambda'

export { Cli }

process.title = 'ept-tools'
process.on('SIGINT', () => process.exit())

const isCliInvocation = require.main === module
if (isCliInvocation) Cli.run()
