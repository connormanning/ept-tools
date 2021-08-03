import { Bounds } from '../bounds'
import { Schema } from '../schema'
import { Srs } from '../srs'

export declare namespace Source {
  export namespace V0 {
    export type Status = 'inserted' | 'error' | 'omitted'
    export namespace Summary {
      export type Item = {
        bounds: Bounds
        id: string
        inserts: number
        path: string
        points: number
        status: Status
        url: string
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
}

export const Source = {
  V0: {
    summary: {
      schema: {
        title: 'EPT data source summary list v1.0.0',
        type: 'array',
        items: {
          title: 'EPT data source summary item v1.0.0',
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
        },
      },
    },
    detail: {
      schema: {
        title: 'EPT data source detail object v1.0.0',
        type: 'object',
        patternProperties: {
          '.*': {
            type: 'object',
            properties: {
              bounds: Bounds.schema,
              srs: Srs.schema,
              metadata: {
                type: 'object',
              },
            },
          },
        },
      },
    },
  },
}
