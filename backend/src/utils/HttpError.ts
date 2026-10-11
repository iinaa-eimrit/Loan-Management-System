/**
 * Throw this anywhere (route, middleware, service) to produce a clean HTTP error.
 * The central error handler turns it into: res.status(status).json({ message, errors }).
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
