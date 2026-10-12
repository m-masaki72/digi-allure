import { json, fail, clientIds, readJSON, dayStart } from "../_lib/api.js";

const MAX_REQUESTS_PER_HOUR = 10;
const MAX_COMMENT = 200;
// 幼年期は掲載対象外なのでリクエストも受け付けない
const NOT_REQUESTABLE = "COALESCE(d.level, '') LIKE '幼年期%'";

// ?1 digimon ?2 ip ?3 1時間前 ?4 今日の開始
const CHECKS = `SELECT
  (SELECT COUNT(*) FROM digimon d WHERE d.id = ?1 AND d.status != 'approved' AND NOT ${NOT_REQUESTABLE}) AS open,
  (SELECT COUNT(*) FROM digimon WHERE id = ?1 AND status = 'approved') AS approved,
  (SELECT COUNT(*) FROM requests WHERE ip_hash = ?2 AND created_at >= ?3) AS recent,
  (SELECT COUNT(*) FROM requests WHERE ip_hash = ?2 AND digimon_id = ?1 AND created_at >= ?4) AS dup`;

// GET /api/requests  リクエストの多い未掲載デジモン（コメントは返さない）
export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT r.digimon_id AS id, d.name_ja AS name, d.level, COUNT(*) AS n
     FROM requests r JOIN digimon d ON d.id = r.digimon_id
     WHERE d.status != 'approved' AND NOT ${NOT_REQUESTABLE}
     GROUP BY r.digimon_id ORDER BY n DESC, MAX(r.created_at) DESC LIMIT 30`
  ).all();
  return json({ requests: results });
}

// POST /api/requests  { id, comment }  未掲載デジモンの掲載リクエスト
export async function onRequestPost({ request, env }) {
  const body = await readJSON(request);
  const id = typeof body?.id === "string" ? body.id : "";
  // 制御文字を除いて長さを制限（コメントは管理人だけが見る）
  const comment = String(body?.comment ?? "").replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").trim();
  if (!id) return fail(400, "デジモンを選んでください");
  if (comment.length > MAX_COMMENT) return fail(400, `コメントは${MAX_COMMENT}文字以内でお願いします`);

  // 不正対策はIP単位で数える。判定と記録を同じ文で行い、同時に送られても上限を超えないようにする
  const { voter, ip } = await clientIds(request, env);
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 3_600_000).toISOString();
  const inserted = await env.DB.prepare(
    `INSERT INTO requests (digimon_id, comment, voter_hash, ip_hash, created_at)
     SELECT ?1, ?5, ?6, ?2, ?7 FROM (${CHECKS})
     WHERE open AND recent < ${MAX_REQUESTS_PER_HOUR} AND dup = 0`
  ).bind(id, ip, hourAgo, dayStart(now), comment || null, voter, now.toISOString()).run();
  if (!inserted.meta.changes) {
    const c = await env.DB.prepare(CHECKS).bind(id, ip, hourAgo, dayStart(now)).first();
    if (c.approved) return fail(409, "そのデジモンはすでに掲載済みです");
    if (!c.open) return fail(404, "そのデジモンは掲載範囲外です");
    if (c.recent >= MAX_REQUESTS_PER_HOUR) return fail(429, "リクエストが多すぎます。時間をおいてどうぞ");
    return fail(409, "このデジモンには今日すでにリクエスト済みです");
  }
  return json({ ok: true });
}
