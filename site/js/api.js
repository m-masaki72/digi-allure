export async function api(path, options) {
  let res;
  try {
    res = await fetch(path, {
      ...options,
      headers: options?.body ? { "content-type": "application/json" } : undefined,
    });
  } catch {
    // オフライン・接続の切断など（fetch の TypeError をそのまま見せない）
    throw new Error("通信に失敗しました。電波の良いところでもう一度お試しください");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    const err = new Error(data?.error || `通信に失敗しました (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}
