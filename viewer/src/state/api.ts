const api_base = `${location.pathname.replace(/\/?$/, "/")}api`;

/** Calls the page's own server. Throws when there is none, or when it refuses. */
export async function api_request<Result>(
  collection: "comments" | "notes",
  method: "GET" | "POST" | "PATCH" | "DELETE",
  id?: string,
  body?: unknown,
): Promise<Result> {
  let url = `${api_base}/${collection}`;
  if (id !== undefined) {
    url = `${url}/${id}`;
  }
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${collection} ${method}: ${response.status}`);
  }
  return (await response.json()) as Result;
}
