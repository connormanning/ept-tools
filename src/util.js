import fs from 'fs'
import util from 'util'

export const readFileAsync = util.promisify(fs.readFile)

export async function getJson(file) {
    const data = await readFileAsync(file)
    return JSON.parse(data)
}

export async function getBuffer(file) {
    return readFileAsync(file)
}

export function popSlash(path) {
    return path.endsWith('/') ? path.slice(0, -1) : path
}

export function basename(path) {
    return popSlash(path).split('/').pop()
}

export function dirname(path) {
    const parts = popSlash(path).split('/')
    return parts.slice(0, -1).join('/')
}

export function padRight(string, mod) {
    const rem = string.length % mod
    if (!rem) return string
    return string + ' '.repeat(mod - rem)
}
