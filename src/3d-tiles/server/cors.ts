import { Context, Next } from 'koa'

export declare namespace Cors {
  export type Options = '*' | string[]
}

export const Cors = { create }
function create(allowedOrigins: '*' | string[] = []) {
  return async function (ctx: Context, next: Next) {
    ctx.set('Access-Control-Allow-Methods', 'GET, HEAD')

    const origin = ctx.request.get('origin')

    // If we have a request origin, and it's allowed either via wildcard or
    // explicit list, then set the response origin to reflect the request value.
    if (origin && (allowedOrigins === '*' || allowedOrigins.includes(origin))) {
      ctx.set('Access-Control-Allow-Origin', origin)
      ctx.set('Vary', 'Origin')
    } else if (allowedOrigins === '*') {
      ctx.set('Access-Control-Allow-Origin', '*')
    } else if (allowedOrigins.length === 1) {
      ctx.set('Access-Control-Allow-Origin', allowedOrigins[0])
    }

    return next()
  }
}
