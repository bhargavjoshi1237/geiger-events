import { ApiError } from "../staff_access/errors.js";

// Workspace errors are ApiErrors, so shared staff routes render them the same way.
export class WorkspaceError extends ApiError {
  constructor(code, status, message, fields = undefined) {
    super(code, status, message, fields);
    this.name = "WorkspaceError";
  }
}
