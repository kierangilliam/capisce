const api_base = `${location.pathname.replace(/\/?$/, "/")}api`;

/** Calls the page's own server. Throws when there is none, or when it refuses. */
export async function api_request<Result>(
  collection: "comments" | "notes" | "timings",
  method: "GET" | "POST" | "PATCH" | "DELETE",
  id?: string,
  body?: unknown,
  under?: "replies",
): Promise<Result> {
  let url = `${api_base}/${collection}`;
  if (id !== undefined) {
    url = `${url}/${id}`;
  }
  if (under !== undefined) {
    url = `${url}/${under}`;
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

export const screenshot_url = (name: string): string => `${api_base}/screenshots/${name}`;

/** Saves a picture beside the comments and returns the name it was saved under. */
export async function upload_screenshot(file: Blob): Promise<string> {
  const response = await fetch(`${api_base}/screenshots`, {
    method: "POST",
    headers: { "content-type": file.type },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`screenshots POST: ${response.status}`);
  }
  return ((await response.json()) as { name: string }).name;
}
