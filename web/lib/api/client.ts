const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001";

export async function apiRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(
    `${API_URL}${path}`,
    {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers ?? {}),
      },
    },
  );

  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => null);

    throw new Error(
      body?.error ??
        `API request failed: ${response.status}`,
    );
  }

  return response.json();
}