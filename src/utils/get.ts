import { Storage } from 'cropy'

export async function getBinary(path: string) {
  return Storage.read(path)
}

export async function getJson(path: string): Promise<unknown> {
  return Storage.readJson(path)
}
