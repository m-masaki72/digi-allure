// Pages Functions 共通処理

export const SCOPES = ["time-stranger", "all"];
export const DEFAULT_SCOPE = "time-stranger";
export const ELO_K = 32;
const PAIR_TTL_MS = 30 * 60 * 1000;

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
export const fail = (status, message) => json({ error: message }, status);

export function scopeOf(value) {
  const s = value || DEFAULT_SCOPE;
  return SCOPES.includes(s) ? s : null;
}

function secretOf(env) {
  if (!env.VOTE_SECRET) throw new Error("VOTE_SECRET が設定されていません");
  return env.VOTE_SECRET;
}

const enc = new TextEncoder();
async function hmac(secret, message) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// 投票者識別: IP + UA に日替わりソルトをかけたハッシュ。生のIPは保存しない
export async function voterHash(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const ua = request.headers.get("User-Agent") || "";
  const day = new Date().toISOString().slice(0, 10);
  const salt = await hmac(secretOf(env), `salt:${day}`);
  return (await hmac(salt, `${ip}\n${ua}`)).slice(0, 32);
}

// サーバーが出したペアにだけ投票できるよう署名する
export async function signPair(env, scope, a, b) {
  const exp = Date.now() + PAIR_TTL_MS;
  return { exp, token: await hmac(secretOf(env), `pair:${scope}|${a}|${b}|${exp}`) };
}
export async function verifyPair(env, { scope, a, b, exp, token }) {
  if (typeof token !== "string" || !Number.isFinite(exp) || exp < Date.now()) return false;
  const expect = await hmac(secretOf(env), `pair:${scope}|${a}|${b}|${exp}`);
  if (expect.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expect.length; i++) diff |= expect.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

// 勝者側の変動量（敗者は同じ量だけ下がる）
export function eloDelta(winnerElo, loserElo, k = ELO_K) {
  const expected = 1 / (1 + 10 ** ((loserElo - winnerElo) / 400));
  return k * (1 - expected);
}

export async function isApproved(env, id) {
  const row = await env.DB.prepare("SELECT 1 FROM digimon WHERE id = ? AND status = 'approved'").bind(id).first();
  return !!row;
}

export async function readJSON(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
