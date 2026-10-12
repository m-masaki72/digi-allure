import { json, fail, scopeOf, verifyPair, clientIds, readJSON, monthKey, monthScope, dayStart, newRowId, ELO_K, DEFAULT_SCOPE } from "../_lib/api.js";

// IPあたりの上限。学校・会社など1つのIPを大勢で使う場合も考えて1日の上限はゆるめ
const MAX_VOTES_PER_MINUTE = 30;
const MAX_VOTES_PER_DAY = 300;

// ?1 ip ?2 scope ?3 a ?4 b ?5 1分前 ?6 今日の開始
const CHECKS = `SELECT
  (SELECT COUNT(*) FROM match_votes WHERE ip_hash = ?1 AND created_at >= ?5) AS recent,
  (SELECT COUNT(*) FROM match_votes WHERE ip_hash = ?1 AND created_at >= ?6) AS today,
  (SELECT COUNT(*) FROM match_votes WHERE ip_hash = ?1 AND game_scope = ?2 AND created_at >= ?6
     AND ((winner_id = ?3 AND loser_id = ?4) OR (winner_id = ?4 AND loser_id = ?3))) AS dup,
  (SELECT COUNT(*) FROM ratings r JOIN digimon d ON d.id = r.digimon_id
     WHERE r.game_scope = ?2 AND d.status = 'approved' AND r.digimon_id IN (?3, ?4)) AS found`;

// 判定と記録を同じ文で行い、同時に届いた投票でも上限・重複を超えないようにする
const INSERT_VOTE = `INSERT INTO match_votes (id, winner_id, loser_id, game_scope, voter_hash, ip_hash, created_at)
  SELECT ?7, ?8, ?9, ?2, ?10, ?1, ?11 FROM (${CHECKS})
  WHERE recent < ${MAX_VOTES_PER_MINUTE} AND today < ${MAX_VOTES_PER_DAY} AND dup = 0 AND found = 2
  ON CONFLICT DO NOTHING`;

// ?1 投票ID ?2 scope ?3 winner ?4 loser。投票が記録されたときだけ、その時点のレートから計算して反映する
const ELO_UPDATE = `UPDATE ratings
  SET elo = elo + CASE ratings.digimon_id WHEN ?3 THEN e.delta ELSE -e.delta END, matches = matches + 1
  FROM (SELECT ${ELO_K} * (1 - 1 / (1 + pow(10, (l.elo - w.elo) / 400.0))) AS delta
        FROM ratings w JOIN ratings l ON l.digimon_id = ?4 AND l.game_scope = ?2
        WHERE w.digimon_id = ?3 AND w.game_scope = ?2) AS e
  WHERE ratings.game_scope = ?2 AND ratings.digimon_id IN (?3, ?4) AND EXISTS (SELECT 1 FROM match_votes WHERE id = ?1)
  RETURNING digimon_id, elo`;

// 月間人気投票：同じ1票を今月のスコープにも反映する（行はその月の初対戦で作る）
function monthlyUpdates(env, voteId, winner, loser, now) {
  const month = monthScope(monthKey(now));
  return [
    env.DB.prepare(
      `INSERT INTO ratings (digimon_id, game_scope) SELECT id, ?2 FROM digimon
       WHERE id IN (?3, ?4) AND EXISTS (SELECT 1 FROM match_votes WHERE id = ?1)
       ON CONFLICT(digimon_id, game_scope) DO NOTHING`
    ).bind(voteId, month, winner, loser),
    env.DB.prepare(ELO_UPDATE).bind(voteId, month, winner, loser),
  ];
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
  const minuteAgo = new Date(now.getTime() - 60_000).toISOString();
  const voteId = newRowId();

  // 不正対策はIP単位で数える（同じIPを共有する人同士でも、同じ組み合わせは1日1票）
  const [checks, inserted, before, after] = await env.DB.batch([
    env.DB.prepare(CHECKS).bind(ip, scope, a, b, minuteAgo, dayStart(now)),
    env.DB.prepare(INSERT_VOTE)
      .bind(ip, scope, a, b, minuteAgo, dayStart(now), voteId, winner, loser, voter, now.toISOString()),
    env.DB.prepare("SELECT digimon_id, elo FROM ratings WHERE game_scope = ? AND digimon_id IN (?, ?)").bind(scope, winner, loser),
    env.DB.prepare(ELO_UPDATE).bind(voteId, scope, winner, loser),
    ...(scope === DEFAULT_SCOPE ? monthlyUpdates(env, voteId, winner, loser, now) : []),
  ]);
  if (!inserted.meta.changes) {
    const c = checks.results[0];
    if (c.found < 2) return fail(404, "対象のデジモンが見つかりません");
    if (c.recent >= MAX_VOTES_PER_MINUTE) return fail(429, "投票が速すぎます。少し待ってからどうぞ");
    if (c.today >= MAX_VOTES_PER_DAY) return fail(429, "今日の投票数の上限に達しました。また明日どうぞ");
    return fail(409, "この組み合わせには今日すでに投票済みです");
  }

  const elo = (rows) => Object.fromEntries(rows.map((r) => [r.digimon_id, r.elo]));
  const [old, cur] = [elo(before.results), elo(after.results)];
  return json({
    winner: { id: winner, elo: cur[winner] },
    loser: { id: loser, elo: cur[loser] },
    delta: cur[winner] - old[winner],
  });
}
