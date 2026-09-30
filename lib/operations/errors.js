export class OperationsError extends Error {
  constructor(code, status, message, fields = undefined) {
    super(message);
    this.name = "OperationsError";
    this.code = code;
    this.status = status;
    if (fields) this.fields = fields;
  }
}
