import { json, fail, scopeOf } from "../../lib/api.js";

// GET /api/ranking?scope=time-stranger
export async function onRequestGet({ request, env }) {
  const scope = scopeOf(new URL(request.url).searchParams.get("scope"));
  if (!scope) return fail(400, "scope が不正です");
  const { results } = await env.DB.prepare(
    `SELECT r.digimon_id AS id, r.elo, r.matches,
            (SELECT COUNT(*) FROM match_votes v WHERE v.winner_id = r.digimon_id AND v.game_scope = r.game_scope) AS wins
     FROM ratings r JOIN digimon d ON d.id = r.digimon_id
     WHERE r.game_scope = ? AND d.status = 'approved'
     ORDER BY r.elo DESC, r.matches DESC`
  ).bind(scope).all();
  return json({ scope, ranking: results });
}
