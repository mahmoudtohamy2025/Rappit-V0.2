/**
 * Type-safe fetcher for API calls
 */

export class FetchError extends Error {
  status: number;
  info: any;

  constructor(message: string, status: number, info: any) {
    super(message);
    this.status = status;
    this.info = info;
  }
}

export async function fetcher<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new FetchError(
      data.message || data.error || 'An error occurred',
      res.status,
      data,
    );
  }

  return data;
}

/**
 * Client-side API fetcher (uses relative URLs)
 */
export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  return fetcher<T>(endpoint, options);
}
