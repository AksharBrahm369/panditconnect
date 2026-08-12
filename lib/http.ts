export async function readJson<T>(response: Response): Promise<T> {
  const body = await response.text();
  if (!body.trim()) {
    return {
      error: response.ok
        ? "The server returned an empty response. Please try again."
        : `The request failed (${response.status}). Please try again.`,
    } as T;
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    return {
      error: `The server returned an unreadable response (${response.status}). Please try again.`,
    } as T;
  }
}
