import { Context, Next } from 'koa'

export const Cors = { create }
function create(allowedOrigins: string) {
  return async function (ctx: Context, next: Next) {
    if (allowedOrigins === '*') {
      const origin = ctx.request.get('origin')
      if (origin) ctx.set('Access-Control-Allow-Origin', origin)
      else ctx.set('Access-Control-Allow-Origin', '*')
    } else if (allowedOrigins.length) {
      ctx.set('Access-Control-Allow-Origin', allowedOrigins)
    }

    ctx.set('Access-Control-Allow-Methods', 'GET, HEAD')
    return next()
  }
}
