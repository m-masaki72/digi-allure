import { json } from "../../../lib/api.js";

// GET /api/tags  タグ定義と、公開中デジモンごとのタグ数
export async function onRequestGet({ env }) {
  const [tags, counts] = await env.DB.batch([
    env.DB.prepare("SELECT id, label, category FROM tags ORDER BY id"),
    env.DB.prepare(
      `SELECT t.digimon_id AS id, t.tag_id, COUNT(*) AS n
       FROM digimon_tags t JOIN digimon d ON d.id = t.digimon_id
       WHERE d.status = 'approved' GROUP BY t.digimon_id, t.tag_id`
    ),
  ]);
  return json({ tags: tags.results, counts: counts.results });
}
