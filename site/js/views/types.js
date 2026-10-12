import { state, navSeq, loadTags, tagLabels } from "../state.js";
import { app, esc, detailHref } from "../ui.js";

// ---------- タイプから探す ----------
export async function viewTypes() {
  const seq = navSeq;
  await loadTags().catch(() => null);
  if (seq !== navSeq) return;
  const group = (keyOf) => {
    const m = new Map();
    for (const d of state.list) for (const k of [].concat(keyOf(d))) {
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(d);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  };
  const link = (d) => `<a href="${detailHref(d)}">${esc(d.name)}</a>`;
  const block = ([k, list]) => `<div class="type-group"><h3>${esc(k)}<small>${list.length}体</small></h3><div class="links">${list.map(link).join("")}</div></div>`;

  let tagSection = "";
  if (state.tags?.counts.length) {
    const byTag = new Map();
    for (const c of [...state.tags.counts].sort((a, b) => b.n - a.n)) {
      const d = state.byId.get(c.id);
      if (!d) continue;
      if (!byTag.has(c.tag_id)) byTag.set(c.tag_id, []);
      byTag.get(c.tag_id).push(d);
    }
    tagSection = `<h2>ファンタグから探す</h2>${[...byTag.entries()].map(([t, list]) => block([tagLabels().get(t), list])).join("")}`;
  }
  app.innerHTML = `
    <h1>タイプから探す</h1>
    <p class="lead">公式図鑑の分類（公式タイプ）と、ファンが付けたタグの2つの軸で探せます。</p>
    ${tagSection}
    <h2>公式タイプ</h2>
    ${group((d) => d.type).map(block).join("")}
    <h2>属性</h2>
    ${group((d) => d.attribute).map(block).join("")}`;
}
