import { EptToolsError } from 'types'

import { Ssl } from './ssl'

test('create', () => {
  expect(Ssl.maybeCreate()).toBeUndefined()
  expect(Ssl.maybeCreate({})).toBeUndefined()

  const keyPath = 'key'
  const certPath = 'cert'
  const caPath = 'ca'

  expect(() => Ssl.maybeCreate({ keyPath })).toThrow(EptToolsError)
  expect(() => Ssl.maybeCreate({ certPath })).toThrow(EptToolsError)
  expect(() => Ssl.maybeCreate({ caPath })).toThrow(EptToolsError)

  expect(Ssl.maybeCreate({ keyPath, certPath })).toEqual({ keyPath, certPath })
  expect(Ssl.maybeCreate({ keyPath, certPath, caPath })).toEqual({
    keyPath,
    certPath,
    caPath,
  })
})
