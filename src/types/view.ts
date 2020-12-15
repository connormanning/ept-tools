export declare namespace View {
  export type Getter = (index: number) => number
  export type Getters = { [name: string]: Getter | undefined }
}

export type View = {
  length: number
  has: (name: string) => boolean
  getter: (name: string) => View.Getter
}
