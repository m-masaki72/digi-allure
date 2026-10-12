import { json, fail, clientIds, isApproved, readJSON } from "../../../lib/api.js";

// IPあたりの上限
const MAX_TAGS_PER_MINUTE = 60;
const MAX_TAGS_PER_DAY = 300;

async function tagsOf(env, id, voter) {
  const { results } = await env.DB.prepare(
    `SELECT g.id, g.label, g.category,
            COUNT(t.voter_hash) AS n,
            MAX(CASE WHEN t.voter_hash = ? THEN 1 ELSE 0 END) AS mine
     FROM tags g LEFT JOIN digimon_tags t ON t.tag_id = g.id AND t.digimon_id = ?
     GROUP BY g.id ORDER BY g.id`
  ).bind(voter, id).all();
  return results.map((r) => ({ ...r, mine: !!r.mine }));
}

// GET /api/tags/:id  そのデジモンのタグ数と、自分が付けたかどうか
export async function onRequestGet({ request, env, params }) {
  if (!(await isApproved(env, params.id))) return fail(404, "見つかりません");
  return json({ id: params.id, tags: await tagsOf(env, params.id, (await clientIds(request, env)).voter) });
}

// POST /api/tags/:id  { tag_id }  付ける／外すを切り替える
export async function onRequestPost({ request, env, params }) {
  const body = await readJSON(request);
  const tagId = Number(body?.tag_id);
  if (!Number.isInteger(tagId)) return fail(400, "tag_id が不正です");
  if (!(await isApproved(env, params.id))) return fail(404, "見つかりません");
  const tag = await env.DB.prepare("SELECT 1 FROM tags WHERE id = ?").bind(tagId).first();
  if (!tag) return fail(404, "タグが見つかりません");

  const { voter, ip } = await clientIds(request, env);
  const removed = await env.DB.prepare(
    "DELETE FROM digimon_tags WHERE digimon_id = ? AND tag_id = ? AND voter_hash = ?"
  ).bind(params.id, tagId, voter).run();
  if (!removed.meta.changes) {
    // 付けるときだけIP単位で制限する（外す操作は水増しにならない）
    const now = new Date();
    const [recent, today, same] = await env.DB.batch([
      env.DB.prepare("SELECT COUNT(*) AS n FROM digimon_tags WHERE ip_hash = ? AND created_at >= ?")
        .bind(ip, new Date(now.getTime() - 60_000).toISOString()),
      env.DB.prepare("SELECT COUNT(*) AS n FROM digimon_tags WHERE ip_hash = ? AND created_at >= ?")
        .bind(ip, now.toISOString().slice(0, 10)),
      env.DB.prepare("SELECT COUNT(*) AS n FROM digimon_tags WHERE ip_hash = ? AND digimon_id = ? AND tag_id = ?")
        .bind(ip, params.id, tagId),
    ]);
    if (recent.results[0].n >= MAX_TAGS_PER_MINUTE) return fail(429, "操作が速すぎます。少し待ってからどうぞ");
    if (today.results[0].n >= MAX_TAGS_PER_DAY) return fail(429, "今日のタグ付けの上限に達しました。また明日どうぞ");
    if (same.results[0].n) return fail(409, "同じ回線から今日すでにこのタグが付けられています");
    await env.DB.prepare(
      "INSERT INTO digimon_tags (digimon_id, tag_id, voter_hash, ip_hash, created_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(params.id, tagId, voter, ip, now.toISOString()).run();
  }
  return json({ id: params.id, tags: await tagsOf(env, params.id, voter) });
}
