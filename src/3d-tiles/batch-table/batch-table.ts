import { Params } from '3d-tiles/types'
import { padEnd } from '3d-tiles/utils'

import { Header } from './header'

export type { Header }

export function create(params: Pick<Params, 'view' | 'options'>) {
  const { header, binary } = Header.create(params)

  return {
    header: padEnd(Buffer.from(JSON.stringify(header)), 0x20),
    binary,
  }
}
