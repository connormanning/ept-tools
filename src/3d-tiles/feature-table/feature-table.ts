import { Translate } from '../pnts/types'
import { padEnd } from '../pnts/utils'

import { Binary } from './binary'
import { Header } from './header'

export { Binary, Header }

export function create(params: Translate) {
  const header = padEnd(
    Buffer.from(JSON.stringify(Header.create(params))),
    0x20
  )

  const binary = padEnd(Binary.create(params))

  return { header, binary }
}
