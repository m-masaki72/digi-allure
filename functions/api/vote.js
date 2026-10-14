import { json, fail, scopeOf, verifySort, clientIds, readJSON, dayStart, newRowId, RANK_POINTS } from "../_lib/api.js";
import { TOP_N, replay, maxPicks } from "../../site/js/sort.js";

// IPあたりの診断結果の投票数。学校・会社など1つのIPを大勢で使う場合も考えて1日の上限はゆるめ
const MAX_VOTES_PER_MINUTE = 3;
const MAX_VOTES_PER_DAY = 20;
const MAX_IDS = 2000;

// ?1 ip ?2 1分前 ?3 今日の開始 ?4.. Top5 の ID
const checksSql = (n) => `SELECT
  (SELECT COUNT(DISTINCT vote_id) FROM top5_votes WHERE ip_hash = ?1 AND created_at >= ?2) AS recent,
  (SELECT COUNT(DISTINCT vote_id) FROM top5_votes WHERE ip_hash = ?1 AND created_at >= ?3) AS today,
  (SELECT COUNT(*) FROM digimon WHERE status = 'approved'
     AND id IN (${Array.from({ length: n }, (_, i) => `?${i + 4}`).join(", ")})) AS found`;

// 判定と記録を同じ文で行い、同時に届いた投票でも上限を超えないようにする。同じ並びの二重投票は uq_top5_votes_token で弾く
// ?1..?3 は checksSql と同じ、?4.. Top5 の ID、続けて vote_id, scope, token, voter, now
function insertSql(n) {
  const at = (k) => `?${n + 4 + k}`;
  const rows = Array.from({ length: n }, (_, i) => `(${i + 1}, ?${i + 4}, ${RANK_POINTS[i]})`).join(", ");
  return `INSERT INTO top5_votes (vote_id, rank, digimon_id, points, game_scope, sort_token, voter_hash, ip_hash, created_at)
    SELECT ${at(0)}, v.column1, v.column2, v.column3, ${at(1)}, ${at(2)}, ${at(3)}, ?1, ${at(4)}
    FROM (VALUES ${rows}) AS v, (${checksSql(n)}) AS c
    WHERE c.recent < ${MAX_VOTES_PER_MINUTE} AND c.today < ${MAX_VOTES_PER_DAY} AND c.found = ${n}
    ON CONFLICT DO NOTHING`;
}

// POST /api/vote  { scope, ids, exp, token, history }
// ids/exp/token は GET /api/sort が配った並び、history は診断で選んだ子のすべて。サーバーで再生して、最後まで終えた診断の Top5 だけを受け付ける
export async function onRequestPost({ request, env }) {
  const body = await readJSON(request);
  if (!body) return fail(400, "JSON が不正です");
  const scope = scopeOf(body.scope);
  const { ids, history } = body;
  if (!scope || !Array.isArray(ids) || ids.length < 2 || ids.length > MAX_IDS || new Set(ids).size !== ids.length
    || !Array.isArray(history) || history.length > maxPicks(ids.length)) {
    return fail(400, "パラメータが不正です");
  }
  if (!(body.exp > Date.now())) return fail(403, "推し診断の有効期限（24時間）が切れたため、ランキングには入りませんでした");
  if (!(await verifySort(env, { scope, ids, exp: body.exp, token: body.token }))) return fail(403, "推し診断のデータが正しくありません");
  let top;
  try {
    const s = replay(ids, history);
    if (s.group || s.top.length !== Math.min(TOP_N, ids.length)) return fail(400, "推し診断がまだ終わっていません");
    top = s.top;
  } catch {
    return fail(400, "選択の履歴が不正です");
  }

  const { voter, ip } = await clientIds(request, env);
  const now = new Date();
  const checks = [ip, new Date(now.getTime() - 60_000).toISOString(), dayStart(now), ...top];
  const inserted = await env.DB.prepare(insertSql(top.length))
    .bind(...checks, newRowId(), scope, body.token, voter, now.toISOString()).run();
  if (!inserted.meta.changes) {
    const c = await env.DB.prepare(checksSql(top.length)).bind(...checks).first();
    if (c.found < top.length) return fail(404, "非公開になった子が含まれているため、ランキングには入りませんでした");
    if (c.recent >= MAX_VOTES_PER_MINUTE) return fail(429, "投票が続いたため、この結果はランキングに入りませんでした。少し待ってから診断してください");
    if (c.today >= MAX_VOTES_PER_DAY) return fail(429, "今日この回線からの投票は上限に達したため、この結果はランキングに入りませんでした");
    return fail(409, "この診断の結果はすでに投票済みです");
  }
  return json({ top: top.map((id, i) => ({ id, points: RANK_POINTS[i] })) });
}
