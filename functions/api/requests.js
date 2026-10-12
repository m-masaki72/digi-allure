import { json, fail, clientIds, readJSON } from "../../lib/api.js";

const MAX_REQUESTS_PER_HOUR = 10;
const MAX_COMMENT = 200;

// GET /api/requests  リクエストの多い未掲載デジモン（コメントは返さない）
export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT r.digimon_id AS id, d.name_ja AS name, d.level, COUNT(*) AS n
     FROM requests r JOIN digimon d ON d.id = r.digimon_id
     WHERE d.status != 'approved'
     GROUP BY r.digimon_id ORDER BY n DESC, MAX(r.created_at) DESC LIMIT 30`
  ).all();
  return json({ requests: results });
}

// POST /api/requests  { id, comment }  未掲載デジモンの掲載リクエスト
export async function onRequestPost({ request, env }) {
  const body = await readJSON(request);
  const id = typeof body?.id === "string" ? body.id : "";
  // 制御文字を除いて長さを制限（コメントは管理人だけが見る）
  const comment = String(body?.comment ?? "").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "").trim();
  if (!id) return fail(400, "デジモンを選んでください");
  if (comment.length > MAX_COMMENT) return fail(400, `コメントは${MAX_COMMENT}文字以内でお願いします`);

  const target = await env.DB.prepare("SELECT status FROM digimon WHERE id = ?").bind(id).first();
  if (!target) return fail(404, "そのデジモンは掲載範囲外です");
  if (target.status === "approved") return fail(409, "そのデジモンはすでに掲載済みです");

  // 不正対策はIP単位で数える
  const { voter, ip } = await clientIds(request, env);
  const now = new Date();
  const [recent, dup] = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) AS n FROM requests WHERE ip_hash = ? AND created_at >= ?")
      .bind(ip, new Date(now.getTime() - 3_600_000).toISOString()),
    env.DB.prepare("SELECT COUNT(*) AS n FROM requests WHERE ip_hash = ? AND digimon_id = ? AND created_at >= ?")
      .bind(ip, id, now.toISOString().slice(0, 10)),
  ]);
  if (recent.results[0].n >= MAX_REQUESTS_PER_HOUR) return fail(429, "リクエストが多すぎます。時間をおいてどうぞ");
  if (dup.results[0].n) return fail(409, "このデジモンには今日すでにリクエスト済みです");

  await env.DB.prepare(
    "INSERT INTO requests (digimon_id, comment, voter_hash, ip_hash, created_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(id, comment || null, voter, ip, now.toISOString()).run();
  return json({ ok: true });
}
