import { Forager } from 'forager'

export async function getBinary(path: string) {
  return Forager.read(path)
}

export async function getJson(path: string): Promise<unknown> {
  return Forager.readJson(path)
}

export async function isReadable(path: string) {
  try {
    await Forager.read(path)
    return true
  } catch (e) {
    return false
  }
}
