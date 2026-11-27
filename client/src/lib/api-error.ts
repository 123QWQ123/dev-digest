/* api-error.ts — the normalized API error. Split from api.ts so UI code can
   branch on `instanceof ApiError` / `.status` without importing the HTTP
   client itself (components reach the API only through lib/hooks/*). */

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
