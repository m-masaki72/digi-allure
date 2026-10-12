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

// 日替わりソルトをかけたハッシュで利用者を識別する。生のIPは保存しない
// - voter: IP + UA。「自分が付けたタグ」など本人の判定用（同じIPを共有する別人を区別する）
// - ip:    IPのみ。重複投票・速度制限など不正対策用（UAの書き換えでは逃れられない）
export async function clientIds(request, env) {
  const ip = ipKey(request.headers.get("CF-Connecting-IP") || "local");
  const ua = request.headers.get("User-Agent") || "";
  const day = dayKey();
  const salt = await hmac(secretOf(env), `salt:${day}`);
  const [voter, ipHash] = await Promise.all([hmac(salt, `${ip}\n${ua}`), hmac(salt, `ip:${ip}`)]);
  return { voter: voter.slice(0, 32), ip: ipHash.slice(0, 32) };
}

// IPv6 は利用者ごとに /64 が割り当てられるのが普通なので、/64 単位で同じ利用者とみなす
export function ipKey(ip) {
  const v6 = ip.toLowerCase().split("%")[0];
  if (!v6.includes(":")) return ip;
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return mapped[1];
  const [head, tail] = v6.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const zeros = 8 - h.length - t.length;
  const groups = tail === undefined ? h : [...h, ...Array(Math.max(zeros, 0)).fill("0"), ...t];
  const prefix = groups.slice(0, 4);
  if (prefix.length < 4 || prefix.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return v6;
  return `${prefix.map((g) => parseInt(g, 16).toString(16)).join(":")}::/64`;
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

// 月間人気投票の区切りは日本時間
const JST_MS = 9 * 60 * 60 * 1000;
export const monthKey = (date = new Date()) => new Date(date.getTime() + JST_MS).toISOString().slice(0, 7);
export const dayKey = (date = new Date()) => new Date(date.getTime() + JST_MS).toISOString().slice(0, 10);
// その日（日本時間）の開始を UTC の ISO 文字列で返す
export const dayStart = (date = new Date()) => new Date(Date.parse(dayKey(date)) - JST_MS).toISOString();
export const monthScope = (key) => `month:${key}`;
export const isMonthKey = (s) => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
// その月の [開始, 終了) を UTC の ISO 文字列で返す（created_at との比較用）
export function monthRange(key) {
  const [y, m] = key.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1) - JST_MS);
  const end = new Date(Date.UTC(y, m, 1) - JST_MS);
  return [start.toISOString(), end.toISOString()];
}

export async function isApproved(env, id) {
  const row = await env.DB.prepare("SELECT 1 FROM digimon WHERE id = ? AND status = 'approved'").bind(id).first();
  return !!row;
}

export function decodeParam(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

// 書き込み用の ID。同じ batch の後続の文で「この書き込みが記録されたか」を判定する目印にする
export const newRowId = () => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) + 1;

export async function readJSON(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
