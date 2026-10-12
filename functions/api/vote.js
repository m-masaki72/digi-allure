import { json, fail, scopeOf, verifyPair, clientIds, eloDelta, readJSON, monthKey, monthScope, DEFAULT_SCOPE } from "../../lib/api.js";

// IPあたりの上限。学校・会社など1つのIPを大勢で使う場合も考えて1日の上限はゆるめ
const MAX_VOTES_PER_MINUTE = 30;
const MAX_VOTES_PER_DAY = 300;

// 月間人気投票：同じ1票を今月のスコープにも反映する（行はその月の初対戦で作る）
async function monthlyUpdates(env, winner, loser, now) {
  const month = monthScope(monthKey(now));
  const { results } = await env.DB.prepare(
    "SELECT digimon_id, elo FROM ratings WHERE game_scope = ? AND digimon_id IN (?, ?)"
  ).bind(month, winner, loser).all();
  const elo = { [winner]: 1500, [loser]: 1500, ...Object.fromEntries(results.map((r) => [r.digimon_id, r.elo])) };
  const delta = eloDelta(elo[winner], elo[loser]);
  const upsert = env.DB.prepare(
    `INSERT INTO ratings (digimon_id, game_scope, elo, matches) VALUES (?, ?, 1500 + ?, 1)
     ON CONFLICT(digimon_id, game_scope) DO UPDATE SET elo = elo + excluded.elo - 1500, matches = matches + 1`
  );
  return [upsert.bind(winner, month, delta), upsert.bind(loser, month, -delta)];
}

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
  const { voter, ip } = await clientIds(request, env);
  const now = new Date();
  const dayStart = now.toISOString().slice(0, 10);
  const minuteAgo = new Date(now.getTime() - 60_000).toISOString();

  // 不正対策はIP単位で数える（同じIPを共有する人同士でも、同じ組み合わせは1日1票）
  const [recent, today, dup] = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) AS n FROM match_votes WHERE ip_hash = ? AND created_at >= ?").bind(ip, minuteAgo),
    env.DB.prepare("SELECT COUNT(*) AS n FROM match_votes WHERE ip_hash = ? AND created_at >= ?").bind(ip, dayStart),
    env.DB.prepare(
      `SELECT COUNT(*) AS n FROM match_votes WHERE ip_hash = ? AND game_scope = ? AND created_at >= ?
         AND ((winner_id = ? AND loser_id = ?) OR (winner_id = ? AND loser_id = ?))`
    ).bind(ip, scope, dayStart, a, b, b, a),
  ]);
  if (recent.results[0].n >= MAX_VOTES_PER_MINUTE) return fail(429, "投票が速すぎます。少し待ってからどうぞ");
  if (today.results[0].n >= MAX_VOTES_PER_DAY) return fail(429, "今日の投票数の上限に達しました。また明日どうぞ");
  if (dup.results[0].n) return fail(409, "この組み合わせには今日すでに投票済みです");

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
      "INSERT INTO match_votes (winner_id, loser_id, game_scope, voter_hash, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(winner, loser, scope, voter, ip, now.toISOString()),
    update.bind(delta, winner, scope),
    update.bind(-delta, loser, scope),
    ...(scope === DEFAULT_SCOPE ? await monthlyUpdates(env, winner, loser, now) : []),
  ]);
  return json({
    winner: { id: winner, elo: elo[winner] + delta },
    loser: { id: loser, elo: elo[loser] - delta },
    delta,
  });
}
