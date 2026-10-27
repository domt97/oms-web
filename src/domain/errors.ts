/** A failure the UI can show. Adapters translate transport errors into this. */
export class AppError extends Error {
  readonly status: number;
  readonly details: string[];

  constructor(status: number, message: string, details: string[] = []) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.details = details;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isUnavailable(): boolean {
    return this.status === 0 || this.status >= 502;
  }
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  return new AppError(0, e instanceof Error ? e.message : String(e));
}
