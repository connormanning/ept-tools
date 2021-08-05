import { Bounds } from '../bounds'
import { Schema } from '../schema'
import { Srs } from '../srs'

export declare namespace Source {
  export namespace Summary {
    export type Item = {
      bounds: Bounds
      path: string
      points: number
      inserted: boolean
      metadataPath: string
    }
  }
  export type Summary = Summary.Item[]

  export type Detail = {
    bounds: Bounds
    path: string
    points: number
    metadata?: object
    pipeline?: (object | string)[]
    schema?: Schema
    srs?: Srs
  }

  export namespace V0 {
    export type Status = 'inserted' | 'error' | 'omitted'
    export namespace Summary {
      export type Item = {
        bounds?: Bounds
        id: string
        path: string
        status: Status
        url?: string
        inserts?: number
        points?: number
      }
    }
    export type Summary = Summary.Item[]

    export namespace Detail {
      export type Item = {
        bounds: Bounds
        srs: Srs
        metadata?: object
      }
    }
    export type Detail = Record<string, Detail.Item>
  }

}

export const Source = {
  summary: {
    schema: {
      title: 'EPT source data manifest',
      type: 'array',
      items: {
        title: 'EPT source data manifest',
        type: 'object',
        properties: {
          path: { type: 'string' },
          bounds: Bounds.schema,
          points: { type: 'integer' },
          inserted: { type: 'boolean' },
          metadataPath: { type: 'string' },
        },
        required: ['path', 'bounds', 'points'],
      },
    },
  },
  detail: {
    schema: {
      title: 'EPT source data detail object v1.0.0',
      type: 'object',
      properties: {
        path: { type: 'string' },
        bounds: Bounds.schema,
        schema: Schema.schema,
        srs: Srs.schema,
        metadata: { type: 'object' },
      },
      required: ['path', 'bounds'],
    },
  },
  V0: {
    summary: {
      schema: {
        title: 'EPT source data summary list v1.0.0',
        type: 'array',
        items: {
          title: 'EPT source data summary item v1.0.0',
          type: 'object',
          properties: {
            bounds: Bounds.schema,
            id: { type: 'string' },
            inserts: { type: 'integer' },
            path: { type: 'string' },
            points: { type: 'integer' },
            status: { type: 'string', enum: ['inserted', 'error', 'omitted'] },
            url: { type: 'string' },
          },
          required: ['path'],
        },
      },
    },
    detail: {
      schema: {
        title: 'EPT source data detail object v1.0.0',
        type: 'object',
        patternProperties: {
          '.*': {
            type: 'object',
            properties: {
              bounds: Bounds.schema,
              srs: Srs.schema,
              metadata: { type: 'object' },
            },
          },
        },
      },
    },
  },
}
