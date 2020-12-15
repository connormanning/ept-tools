import { Bounds } from './bounds'
import { DataType } from './data-type'
import { HierarchyType } from './hierarchy-type'
import { Schema } from './schema'
import { Srs } from './srs'

export type Ept = {
  bounds: Bounds
  boundsConforming: Bounds
  dataType: DataType
  hierarchyType: HierarchyType
  points: number
  schema: Schema
  span: number
  srs?: Srs
  version: '1.0.0'
}
