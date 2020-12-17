import { join } from 'path'

export * as Dummy from './dummy'
export * as Ellipsoid from './ellipsoid'
export * as Pnts from './pnts'
export * as Server from './server'

export const testdir = join(__dirname, 'data')
export const keyfile = join(__dirname, 'ssl/fake.key')
export const certfile = join(__dirname, 'ssl/fake.cert')
export const cafile = join(__dirname, 'ssl/ca.pem')
