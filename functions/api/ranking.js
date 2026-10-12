import { json, fail, scopeOf, monthKey, monthScope, monthRange, isMonthKey, DEFAULT_SCOPE } from "../../lib/api.js";

// GET /api/ranking?scope=time-stranger          通算
// GET /api/ranking?month=2026-10 | current      月間人気投票（日本時間の暦月）
export async function onRequestGet({ request, env }) {
  const params = new URL(request.url).searchParams;
  const current = monthKey();
  const month = params.get("month") === "current" ? current : params.get("month");
  const { results: monthRows } = await env.DB.prepare(
    "SELECT DISTINCT substr(game_scope, 7) AS m FROM ratings WHERE game_scope LIKE 'month:%' ORDER BY m DESC"
  ).all();
  const months = [...new Set([current, ...monthRows.map((r) => r.m)])].sort().reverse();

  if (month !== null) {
    if (!isMonthKey(month)) return fail(400, "month が不正です");
    const [start, end] = monthRange(month);
    const { results } = await env.DB.prepare(
      `SELECT r.digimon_id AS id, r.elo, r.matches,
              (SELECT COUNT(*) FROM match_votes v WHERE v.winner_id = r.digimon_id AND v.game_scope = ?
                 AND v.created_at >= ? AND v.created_at < ?) AS wins
       FROM ratings r JOIN digimon d ON d.id = r.digimon_id
       WHERE r.game_scope = ? AND d.status = 'approved'
       ORDER BY r.elo DESC, r.matches DESC`
    ).bind(DEFAULT_SCOPE, start, end, monthScope(month)).all();
    return json({ month, current, months, final: month < current, ranking: results });
  }

  const scope = scopeOf(params.get("scope"));
  if (!scope) return fail(400, "scope が不正です");
  const { results } = await env.DB.prepare(
    `SELECT r.digimon_id AS id, r.elo, r.matches,
            (SELECT COUNT(*) FROM match_votes v WHERE v.winner_id = r.digimon_id AND v.game_scope = r.game_scope) AS wins
     FROM ratings r JOIN digimon d ON d.id = r.digimon_id
     WHERE r.game_scope = ? AND d.status = 'approved'
     ORDER BY r.elo DESC, r.matches DESC`
  ).bind(scope).all();
  return json({ scope, current, months, ranking: results });
}
