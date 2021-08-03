import symbols from 'log-symbols'

import { Ept } from 'ept'
import { JsonSchema, getJson } from 'utils'

export async function validate(input: string) {
  const [, errors] = JsonSchema.validate<Ept>(Ept.schema, await getJson(input))

  if (errors.length) {
    console.log(symbols.error, 'Errors:')
    errors.forEach((v) => console.log(`\t• ${v}`))
    console.log()

    console.log(symbols.error, 'EPT is not valid')
    process.exit(1)
  } else console.log(symbols.success, 'EPT appears to be valid')
}
