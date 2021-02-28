import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda'
import { join } from 'protopath'
import util from 'util'
import zlib from 'zlib'

import * as Cesium from '3d-tiles'

const gzipAsync = util.promisify(zlib.gzip)

export async function handler(
  event: APIGatewayProxyEventV2
  // context: APIGatewayEventRequestContext
): Promise<APIGatewayProxyResult> {
  const root = process.env.ROOT
  if (!root) throw new Error('Invalid root path')

  const subpath = event.pathParameters?.filename
  if (!subpath) throw new Error('Invalid filename')

  const filename = join(root, subpath)
  const options = Cesium.parseQuery(event.queryStringParameters || {})

  console.log('Filename:', filename)
  console.log('Options:', options)

  const data = await Cesium.translate({ filename, options })

  const isCompressed =
    event.headers['accept-encoding']
      ?.split(',')
      .map((s: string) => s.trim())
      .includes('gzip') || false

  return data instanceof Buffer
    ? formatBufferResponse(data, isCompressed)
    : formatJsonResponse(data, false)
}

async function formatBufferResponse(
  data: Buffer,
  isCompressed: boolean
): Promise<APIGatewayProxyResult> {
  const body = isCompressed ? await gzipAsync(data) : data

  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
    ...(isCompressed && { 'Content-Encoding': 'gzip' }),
  }

  return {
    statusCode: 200,
    headers,
    isBase64Encoded: true,
    body: body.toString('base64'),
  }
}

async function formatJsonResponse(
  data: unknown,
  isCompressed: boolean
): Promise<APIGatewayProxyResult> {
  const stringified = JSON.stringify(data)
  const body = isCompressed
    ? await gzipAsync(stringified)
    : Buffer.from(stringified)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(isCompressed && { 'Content-Encoding': 'gzip' }),
  }

  console.log('Data:', JSON.stringify(data, null, 2))
  console.log('Compressed:', body.length / stringified.length)

  return {
    statusCode: 200,
    headers,
    body: body.toString('utf8'),
  }
}
