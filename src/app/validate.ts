import symbols from 'log-symbols'

import { JsonSchema } from 'ept'
import { getJson } from 'utils'

export async function validate(input: string) {
  const [, errors] = JsonSchema.parse(await getJson(input))

  if (errors.length) {
    console.log(symbols.error, 'Errors:')
    errors.forEach((v) => console.log(`\t• ${v}`))
    console.log()

    console.log(symbols.error, 'EPT is not valid')
    process.exit(1)
  } else console.log(symbols.success, 'EPT appears to be valid')
}
