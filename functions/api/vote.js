import { json, fail, scopeOf, verifyPair, voterHash, eloDelta, readJSON } from "../../lib/api.js";

const MAX_VOTES_PER_MINUTE = 30;

// POST /api/vote  { scope, a, b, exp, token, winner }
export async function onRequestPost({ request, env }) {
  const body = await readJSON(request);
  if (!body) return fail(400, "JSON が不正です");
  const scope = scopeOf(body.scope);
  const { a, b, winner } = body;
  if (!scope || !a || !b || a === b || (winner !== a && winner !== b)) return fail(400, "パラメータが不正です");
  if (!(await verifyPair(env, { scope, a, b, exp: body.exp, token: body.token }))) {
    return fail(403, "対戦カードの有効期限が切れました。もう一度お試しください");
  }
  const loser = winner === a ? b : a;
  const voter = await voterHash(request, env);
  const now = new Date();
  const dayStart = now.toISOString().slice(0, 10);
  const minuteAgo = new Date(now.getTime() - 60_000).toISOString();

  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM match_votes WHERE voter_hash = ? AND created_at >= ?"
  ).bind(voter, minuteAgo).first();
  if (recent.n >= MAX_VOTES_PER_MINUTE) return fail(429, "投票が速すぎます。少し待ってからどうぞ");

  const dup = await env.DB.prepare(
    `SELECT 1 FROM match_votes WHERE voter_hash = ? AND game_scope = ? AND created_at >= ?
       AND ((winner_id = ? AND loser_id = ?) OR (winner_id = ? AND loser_id = ?)) LIMIT 1`
  ).bind(voter, scope, dayStart, a, b, b, a).first();
  if (dup) return fail(409, "この組み合わせには今日すでに投票済みです");

  const { results } = await env.DB.prepare(
    `SELECT r.digimon_id, r.elo FROM ratings r JOIN digimon d ON d.id = r.digimon_id
     WHERE r.game_scope = ? AND d.status = 'approved' AND r.digimon_id IN (?, ?)`
  ).bind(scope, winner, loser).all();
  const elo = Object.fromEntries(results.map((r) => [r.digimon_id, r.elo]));
  if (elo[winner] === undefined || elo[loser] === undefined) return fail(404, "対象のデジモンが見つかりません");

  const delta = eloDelta(elo[winner], elo[loser]);
  const update = env.DB.prepare(
    "UPDATE ratings SET elo = elo + ?, matches = matches + 1 WHERE digimon_id = ? AND game_scope = ?"
  );
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO match_votes (winner_id, loser_id, game_scope, voter_hash, created_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(winner, loser, scope, voter, now.toISOString()),
    update.bind(delta, winner, scope),
    update.bind(-delta, loser, scope),
  ]);
  return json({
    winner: { id: winner, elo: elo[winner] + delta },
    loser: { id: loser, elo: elo[loser] - delta },
    delta,
  });
}
