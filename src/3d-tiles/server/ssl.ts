import { EptToolsError } from 'types'

export declare namespace Ssl {
  export type Options = { keyfile: string; certfile: string; cafile?: string }
}
export const Ssl = { maybeCreate }

function maybeCreate({ keyfile, certfile, cafile }: Partial<Ssl.Options> = {}):
  | Ssl.Options
  | undefined {
  if (keyfile || certfile) {
    if (!keyfile || !certfile) {
      throw new EptToolsError(
        'If SSL keyfile or certfile are provided, then both must be provided'
      )
    }

    return { keyfile, certfile, cafile }
  }

  if (cafile) {
    throw new EptToolsError(
      'Cannot provide cafile without keyfile and certfile'
    )
  }
}
