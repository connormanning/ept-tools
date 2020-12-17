import { EptToolsError } from 'types'

import { Ssl } from './ssl'

test('create', () => {
  expect(Ssl.maybeCreate()).toBeUndefined()
  expect(Ssl.maybeCreate({})).toBeUndefined()

  const keyfile = 'key'
  const certfile = 'cert'
  const cafile = 'ca'

  expect(() => Ssl.maybeCreate({ keyfile })).toThrow(EptToolsError)
  expect(() => Ssl.maybeCreate({ certfile })).toThrow(EptToolsError)
  expect(() => Ssl.maybeCreate({ cafile })).toThrow(EptToolsError)

  expect(Ssl.maybeCreate({ keyfile, certfile })).toEqual({ keyfile, certfile })
  expect(Ssl.maybeCreate({ keyfile, certfile, cafile })).toEqual({
    keyfile,
    certfile,
    cafile,
  })
})
