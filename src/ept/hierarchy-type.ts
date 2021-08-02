import { Schema } from 'ajv'

export type HierarchyType = 'json'

const schema: Schema = {
  title: 'Hierarchy type',
  description: 'Hierarchy data encoding',
  type: 'string',
  enum: ['json'],
}

export const HierarchyType = { schema }
