import { json, fail, scopeOf, monthKey, monthRange, isMonthKey, DEFAULT_SCOPE } from "../_lib/api.js";

// 推し診断の Top5 の得点（1位10点〜5位1点）の合計で並べる。?2, ?3 は期間 [開始, 終了)
const rankingSql = `SELECT v.digimon_id AS id, SUM(v.points) AS points,
    SUM(v.rank = 1) AS firsts, COUNT(*) AS entries
  FROM top5_votes v JOIN digimon d ON d.id = v.digimon_id
  WHERE v.game_scope = ?1 AND d.status = 'approved' AND v.created_at >= ?2 AND v.created_at < ?3
  GROUP BY v.digimon_id
  ORDER BY points DESC, firsts DESC, entries DESC, v.digimon_id`;
const votesSql = "SELECT COUNT(DISTINCT vote_id) AS n FROM top5_votes WHERE game_scope = ?1 AND created_at >= ?2 AND created_at < ?3";
const ALL_TIME = ["", "9999"];

// GET /api/ranking?scope=time-stranger          通算
// GET /api/ranking?month=2026-10 | current      月間人気投票（日本時間の暦月）
export async function onRequestGet({ request, env }) {
  const params = new URL(request.url).searchParams;
  const current = monthKey();
  const month = params.get("month") === "current" ? current : params.get("month");
  const { results: monthRows } = await env.DB.prepare(
    "SELECT DISTINCT strftime('%Y-%m', created_at, '+9 hours') AS m FROM top5_votes WHERE game_scope = ?1"
  ).bind(DEFAULT_SCOPE).all();
  const months = [...new Set([current, ...monthRows.map((r) => r.m)])].sort().reverse();

  const query = async (scope, [start, end]) => {
    const [rows, votes] = await env.DB.batch([
      env.DB.prepare(rankingSql).bind(scope, start, end),
      env.DB.prepare(votesSql).bind(scope, start, end),
    ]);
    return { votes: votes.results[0].n, ranking: rows.results };
  };

  if (month !== null) {
    if (!isMonthKey(month)) return fail(400, "month が不正です");
    if (month > current) return fail(400, "その月の人気投票はまだ始まっていません");
    if (!months.includes(month)) return fail(404, "その月の人気投票の記録はありません");
    return json({ month, current, months, final: month < current, ...(await query(DEFAULT_SCOPE, monthRange(month))) });
  }

  const scope = scopeOf(params.get("scope"));
  if (!scope) return fail(400, "scope が不正です");
  return json({ scope, current, months, ...(await query(scope, ALL_TIME)) });
}
