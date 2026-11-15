// Errors safe to show to signed-in staff: a stable code, an HTTP status and a plain sentence.
export class ApiError extends Error {
  constructor(code, status, message, fields = undefined) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    if (fields) this.fields = fields;
  }
}
