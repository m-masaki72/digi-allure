import { json, fail, scopeOf, signPair } from "../../lib/api.js";

// GET /api/pair?scope=time-stranger
// 片方は対戦数の少ない個体から、もう片方は全体からランダムに選ぶ
export async function onRequestGet({ request, env }) {
  const scope = scopeOf(new URL(request.url).searchParams.get("scope"));
  if (!scope) return fail(400, "scope が不正です");

  const base = `SELECT d.id FROM ratings r JOIN digimon d ON d.id = r.digimon_id
                WHERE d.status = 'approved' AND r.game_scope = ?`;
  const low = await env.DB.prepare(`${base} ORDER BY r.matches ASC, RANDOM() LIMIT 12`).bind(scope).all();
  if (low.results.length < 2) return fail(503, "投票できるデジモンが足りません");
  const a = low.results[Math.floor(Math.random() * low.results.length)].id;
  const other = await env.DB.prepare(`${base} AND d.id != ? ORDER BY RANDOM() LIMIT 1`).bind(scope, a).first();
  const b = other.id;
  // 左右の偏りを避ける
  const [left, right] = Math.random() < 0.5 ? [a, b] : [b, a];
  const { exp, token } = await signPair(env, scope, left, right);
  return json({ scope, a: left, b: right, exp, token });
}
