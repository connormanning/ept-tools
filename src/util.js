import fs from 'fs'
import path from 'path'
import util from 'util'

import request from 'request-promise-native'

export const protocolSeparator = '://'
export const readFileAsync = util.promisify(fs.readFile)

export function getProtocol(p) {
    const index = p.indexOf(protocolSeparator)
    if (index != -1) return p.substring(0, index)
    else return null
}

export function stripProtocol(p) {
    const protocol = getProtocol(p)
    if (!protocol) return p
    return p.slice(protocol.length + protocolSeparator.length)
}

export function join(...args) {
    return path.join(...args)
}

export function protojoin(p) {
    const protocol = getProtocol(p)
    const prefix = protocol ? protocol + protocolSeparator : ''
    const args = [stripProtocol(p)].concat(Array.from(arguments).slice(1))
    return prefix + join(...args)
}

export async function getBuffer(file) {
    const protocol = getProtocol(file)
    if (!protocol || protocol === 'file') return readFileAsync(file)
    return request({ uri: file, encoding: null })
}

export async function getJson(file) {
    const data = await getBuffer(file)
    return JSON.parse(data)
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
