import { json, fail, scopeOf, signSort, shuffle } from "../_lib/api.js";

// GET /api/sort?scope=time-stranger
// 推し診断の並び順（公開中の全員をランダムに並べたもの）を署名付きで返す。この並びの勝ち抜き木で出た組にだけ投票できる
export async function onRequestGet({ request, env }) {
  const scope = scopeOf(new URL(request.url).searchParams.get("scope"));
  if (!scope) return fail(400, "scope が不正です");
  const { results } = await env.DB.prepare(
    `SELECT d.id FROM ratings r JOIN digimon d ON d.id = r.digimon_id
     WHERE d.status = 'approved' AND r.game_scope = ?`
  ).bind(scope).all();
  const ids = shuffle(results.map((r) => r.id));
  if (ids.length < 2) return fail(503, "推し診断できるデジモンがまだいません");
  const { exp, token } = await signSort(env, scope, ids);
  return json({ scope, ids, exp, token });
}
