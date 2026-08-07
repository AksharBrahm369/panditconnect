export async function readJson<T>(response: Response): Promise<T> {
  const body = await response.text();
  if (!body.trim()) {
    return { error: response.ok ? "The server returned an empty response. Please try again." : `Request failed (${response.status}).` } as T;
  }
  try {
    return JSON.parse(body) as T;
  } catch {
    return { error: response.ok ? "The server returned an invalid response. Please try again." : `Request failed (${response.status}).` } as T;
  }
}
