import { promises as fs } from 'fs'
import fetch from 'node-fetch'
import { getProtocol } from 'protopath'

import { EptToolsError } from '../types'

async function runFetch(url: string) {
  const response = await fetch(url)
  const { ok, status, statusText } = response
  if (!ok) {
    const type = response.headers.get('content-type')
    const body =
      type && type.startsWith('application/json')
        ? await response.json()
        : await response.text()
    throw new EptToolsError(`${status} ${statusText}`)
  }
  return response
}

export async function getBinary(path: string): Promise<Buffer> {
  const protocol = getProtocol(path)
  if (!protocol || protocol === 'file') return fs.readFile(path)

  const response = await runFetch(path)
  return response.buffer()
}

export async function getJson(path: string): Promise<unknown> {
  const binary = await getBinary(path)
  return JSON.parse(binary.toString('utf8'))
}
