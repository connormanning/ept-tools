import { Driver, Forager } from 'forager'
import { join, stripProtocol } from 'protopath'

import { Ept } from 'ept'

async function readJson(storage: Driver, filename: string) {
  return JSON.parse((await storage.read(filename)).toString())
}

export async function upgrade(
  protofilename: string,
  credentials?: Forager.Options
) {
  const protocol = Forager.getProtocolOrDefault(protofilename)
  const filename = stripProtocol(protofilename)
  if (!filename.endsWith('ept.json')) {
    throw new Error('Filename must end with "ept.json"')
  }
  const dir = join(filename, '..')
  const storage = Forager.create(protocol, credentials)

  const ept: Ept = JSON.parse((await storage.read(filename)).toString())
  console.log(ept, ept.version)

  const [old, cur] = await Promise.allSettled([
    readJson(storage, join(dir, 'ept-sources/manifest.json')),
    readJson(storage, join(dir, 'ept-sources/list.json')),
  ])
  console.log('Old:', old)
  console.log('New:', cur)
}
