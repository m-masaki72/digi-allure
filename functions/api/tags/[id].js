import { json, fail, clientIds, isApproved, readJSON, decodeParam, dayStart, newRowId } from "../../../lib/api.js";

// IPあたりの上限
const MAX_TAGS_PER_MINUTE = 60;
const MAX_TAGS_PER_DAY = 300;

function tagsQuery(env, id, voter) {
  return env.DB.prepare(
    `SELECT g.id, g.label, g.category,
            COUNT(t.voter_hash) AS n,
            MAX(CASE WHEN t.voter_hash = ? THEN 1 ELSE 0 END) AS mine
     FROM tags g LEFT JOIN digimon_tags t ON t.tag_id = g.id AND t.digimon_id = ?
     GROUP BY g.id ORDER BY g.id`
  ).bind(voter, id);
}
const tagsOf = ({ results }) => results.map((r) => ({ ...r, mine: !!r.mine }));

// ?1 digimon ?2 tag ?3 voter ?4 ip ?5 1分前 ?6 今日の開始
const CHECKS = `SELECT
  EXISTS (SELECT 1 FROM digimon WHERE id = ?1 AND status = 'approved') AS approved,
  EXISTS (SELECT 1 FROM tags WHERE id = ?2) AS tag,
  EXISTS (SELECT 1 FROM digimon_tags WHERE digimon_id = ?1 AND tag_id = ?2 AND voter_hash = ?3) AS mine,
  (SELECT COUNT(*) FROM digimon_tags WHERE ip_hash = ?4 AND digimon_id = ?1 AND tag_id = ?2) AS same,
  (SELECT COUNT(*) FROM tag_actions WHERE ip_hash = ?4 AND created_at >= ?5) AS recent,
  (SELECT COUNT(*) FROM tag_actions WHERE ip_hash = ?4 AND created_at >= ?6) AS today`;

// 付ける／外すのどちらをするかを操作記録として先に確定させ、後続の文はその記録を見て実行する。
// 判定と書き込みが同じ batch（トランザクション）の中で済むので、同時に押されても結果が食い違わない
const RECORD = `INSERT INTO tag_actions (id, ip_hash, kind, created_at)
  SELECT ?7, ?4, CASE WHEN mine THEN 'remove' ELSE 'add' END, ?8 FROM (${CHECKS})
  WHERE approved AND tag AND recent < ${MAX_TAGS_PER_MINUTE} AND today < ${MAX_TAGS_PER_DAY} AND (mine OR same = 0)`;

// GET /api/tags/:id  そのデジモンのタグ数と、自分が付けたかどうか
export async function onRequestGet({ request, env, params }) {
  const id = decodeParam(params.id);
  if (!id || !(await isApproved(env, id))) return fail(404, "見つかりません");
  return json({ id, tags: tagsOf(await tagsQuery(env, id, (await clientIds(request, env)).voter).all()) });
}

// POST /api/tags/:id  { tag_id }  付ける／外すを切り替える
export async function onRequestPost({ request, env, params }) {
  const id = decodeParam(params.id);
  const body = await readJSON(request);
  const tagId = Number(body?.tag_id);
  if (!Number.isInteger(tagId)) return fail(400, "tag_id が不正です");
  if (!id) return fail(404, "見つかりません");

  // 外す操作も上限に数える（付け外しの繰り返しで書き込みが増え続けないように）
  const { voter, ip } = await clientIds(request, env);
  const now = new Date();
  const minuteAgo = new Date(now.getTime() - 60_000).toISOString();
  const actionId = newRowId();
  const action = "SELECT 1 FROM tag_actions WHERE id = ?4 AND kind = ?5";
  const [checks, recorded, , , tags] = await env.DB.batch([
    env.DB.prepare(CHECKS).bind(id, tagId, voter, ip, minuteAgo, dayStart(now)),
    env.DB.prepare(RECORD).bind(id, tagId, voter, ip, minuteAgo, dayStart(now), actionId, now.toISOString()),
    env.DB.prepare(`DELETE FROM digimon_tags WHERE digimon_id = ?1 AND tag_id = ?2 AND voter_hash = ?3 AND EXISTS (${action})`)
      .bind(id, tagId, voter, actionId, "remove"),
    env.DB.prepare(
      `INSERT INTO digimon_tags (digimon_id, tag_id, voter_hash, ip_hash, created_at)
       SELECT ?1, ?2, ?3, ?6, ?7 WHERE EXISTS (${action}) ON CONFLICT DO NOTHING`
    ).bind(id, tagId, voter, actionId, "add", ip, now.toISOString()),
    tagsQuery(env, id, voter),
  ]);
  if (!recorded.meta.changes) {
    const c = checks.results[0];
    if (!c.approved) return fail(404, "見つかりません");
    if (!c.tag) return fail(404, "タグが見つかりません");
    if (c.recent >= MAX_TAGS_PER_MINUTE) return fail(429, "操作が速すぎます。少し待ってからどうぞ");
    if (c.today >= MAX_TAGS_PER_DAY) return fail(429, "今日のタグ付けの上限に達しました。また明日どうぞ");
    return fail(409, "同じ回線から今日すでにこのタグが付けられています");
  }
  return json({ id, tags: tagsOf(tags) });
}
