export async function api(path, options) {
  const res = await fetch(path, {
    ...options,
    headers: options?.body ? { "content-type": "application/json" } : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    const err = new Error(data?.error || `通信に失敗しました (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}
