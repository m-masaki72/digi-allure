import { json, fail, scopeOf, signPair, clientIds, dayStart } from "../../lib/api.js";

const pick = (list) => list[Math.floor(Math.random() * list.length)];

// GET /api/pair?scope=time-stranger
// 片方は対戦数の少ない個体から、もう片方は全体からランダムに選ぶ。今日このIPで投票済みの組み合わせは出さない
export async function onRequestGet({ request, env }) {
  const scope = scopeOf(new URL(request.url).searchParams.get("scope"));
  if (!scope) return fail(400, "scope が不正です");

  const { ip } = await clientIds(request, env);
  const base = `SELECT d.id FROM ratings r JOIN digimon d ON d.id = r.digimon_id
                WHERE d.status = 'approved' AND r.game_scope = ?`;
  const [low, all, voted] = await env.DB.batch([
    env.DB.prepare(`${base} ORDER BY r.matches ASC, RANDOM() LIMIT 12`).bind(scope),
    env.DB.prepare(base).bind(scope),
    env.DB.prepare("SELECT winner_id, loser_id FROM match_votes WHERE ip_hash = ? AND game_scope = ? AND created_at >= ?")
      .bind(ip, scope, dayStart()),
  ]);
  const done = new Set(voted.results.flatMap((v) => [`${v.winner_id}\n${v.loser_id}`, `${v.loser_id}\n${v.winner_id}`]));
  const ids = all.results.map((r) => r.id);
  let pair = null;
  for (const { id: a } of low.results.sort(() => Math.random() - 0.5)) {
    const others = ids.filter((b) => b !== a && !done.has(`${a}\n${b}`));
    if (others.length) {
      pair = [a, pick(others)];
      break;
    }
  }
  if (!pair) return fail(503, "投票できる組み合わせが残っていません");
  // 左右の偏りを避ける
  const [left, right] = Math.random() < 0.5 ? pair : [pair[1], pair[0]];
  const { exp, token } = await signPair(env, scope, left, right);
  return json({ scope, a: left, b: right, exp, token });
}
