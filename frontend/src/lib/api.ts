export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  json?: unknown;
  formData?: FormData;
};

export async function api<T>(path: string, { method = 'GET', json, formData }: Options = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: json !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: formData ?? (json !== undefined ? JSON.stringify(json) : undefined),
    cache: 'no-store',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.message ?? 'Request failed', data.errors);
  return data as T;
}
