export class EptToolsError extends Error {}
export class HttpError extends Error {
  statusCode: number
  constructor(code: number, what: string) {
    super(what)
    this.statusCode = code
  }
}
