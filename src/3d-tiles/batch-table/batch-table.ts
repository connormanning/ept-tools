import { Params } from '3d-tiles/pnts/types'
import { padEnd } from '3d-tiles/utils'

import { Binary } from './binary'
import { Header } from './header'

export type { Header }

export function create(params: Pick<Params, 'view'>) {
  const header = padEnd(
    Buffer.from(JSON.stringify(Header.create(params)) || ''),
    0x20
  )

  const binary = padEnd(Binary.create(params))

  return { header, binary }
}
