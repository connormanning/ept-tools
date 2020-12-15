import { EptToolsError } from '../../types'

export declare namespace Ssl {
  export type Options = { keyPath: string; certPath: string; caPath?: string }
}
export const Ssl = { maybeCreate }

function maybeCreate({ keyPath, certPath, caPath }: Partial<Ssl.Options> = {}):
  | Ssl.Options
  | undefined {
  if (keyPath || certPath) {
    if (!keyPath || !certPath) {
      throw new EptToolsError(
        'If SSL key path or cert path are provided, then both must be provided'
      )
    }

    return { keyPath, certPath, caPath }
  }

  if (caPath) {
    throw new EptToolsError('Cannot provide CA path without key and cert path')
  }
}
