import { fail } from "../../lib/api.js";

// 書き込みは同じサイトからの JSON だけ受け付ける（他サイトのフォームや no-cors の fetch から投票させない）
export async function onRequest({ request, next }) {
  if (request.method === "GET" || request.method === "HEAD") return next();
  const site = request.headers.get("Sec-Fetch-Site");
  const origin = request.headers.get("Origin");
  if ((site && site !== "same-origin") || (origin && origin !== new URL(request.url).origin)) {
    return fail(403, "このサイトの外からは送信できません");
  }
  const type = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") return fail(415, "JSON で送信してください");
  return next();
}
