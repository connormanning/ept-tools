import { Schema } from 'ajv'

export type Hierarchy = { [id: string]: number }

const schema: Schema = {
  title: 'EPT hierarchy',
  description: 'EPT hierarchy contents',
  type: 'object',
  propertyNames: { pattern: '^\\d+-\\d+-\\d+-\\d+' },
  patternProperties: { '.*': { type: 'integer' } },
}
export const Hierarchy = { schema }
