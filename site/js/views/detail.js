import { api } from "../api.js";
import { state, navSeq, loadRanking } from "../state.js";
import { app, esc, art, toast } from "../ui.js";

const OFFICIAL_URL = "https://digimon.net/reference/detail.php?directory_name=";

// ---------- 詳細 ----------
function tagButtons(id, tags) {
  const cats = [...new Set(tags.map((t) => t.category))];
  return cats.map((cat) => `<div class="tag-group"><div class="cat">${esc(cat)}</div>${tags
    .filter((t) => t.category === cat)
    .map((t) => `<button class="tag-btn${t.mine ? " mine" : ""}" data-tag="${t.id}" aria-pressed="${t.mine}">${esc(t.label)}<span class="n">${t.n}</span></button>`)
    .join("")}</div>`).join("");
}

const rankHTML = (rank) => rank ? `<dt>人気</dt><dd>${rank.rank}位（レート ${Math.round(rank.elo)}・${rank.matches}戦）</dd>` : "";

export async function viewDetail(id) {
  const seq = navSeq;
  const d = state.byId.get(id);
  if (!d) {
    app.innerHTML = '<p class="empty">このデジモンは見つかりませんでした。<a href="#/">図鑑へ戻る</a></p>';
    return;
  }
  document.title = `${d.name} — デジアリュール`;
  app.innerHTML = `
    <div class="detail">
      <div>${art(d)}</div>
      <div>
        <div class="no">タイムストレンジャー図鑑 No.${esc(d.no ?? "—")}</div>
        <h1>${esc(d.name)}</h1>
        <dl class="facts" id="facts">
          <dt>世代</dt><dd>${esc(d.level)}</dd>
          <dt>属性</dt><dd>${esc(d.attribute)}</dd>
          <dt>公式タイプ</dt><dd>${esc(d.type)}</dd>
          ${rankHTML(state.ranking?.get(id))}
        </dl>
        ${d.blurb
          ? `<div class="blurb">${esc(d.blurb)}</div>`
          : '<div class="blurb pending">管理人のおすすめコメントは準備中です。</div>'}
        <h2>ファンタグ</h2>
        <p class="lead">当てはまると思うタグを押してください（もう一度押すと取り消し）。</p>
        <div id="tags"><p class="loading">タグを読み込み中…</p></div>
        <div class="actions">
          <a class="btn primary" href="#/vote">2択投票へ</a>
          ${d.official_id ? `<a class="btn" href="${OFFICIAL_URL}${encodeURIComponent(d.official_id)}" target="_blank" rel="noopener">公式図鑑で見る（外部サイト）</a>` : ""}
          <a class="btn" href="#/">図鑑へ戻る</a>
        </div>
      </div>
    </div>`;
  if (!state.ranking) {
    loadRanking().then((r) => {
      if (seq === navSeq) document.getElementById("facts").insertAdjacentHTML("beforeend", rankHTML(r.get(id)));
    }).catch(() => null);
  }
  const box = document.getElementById("tags");
  try {
    const data = await api(`/api/tags/${encodeURIComponent(id)}`);
    if (seq !== navSeq) return;
    box.innerHTML = tagButtons(id, data.tags);
  } catch (e) {
    if (seq === navSeq) box.innerHTML = `<p class="error">${esc(e.message)}</p>`;
    return;
  }
  box.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-tag]");
    if (!b) return;
    box.querySelectorAll("button").forEach((x) => (x.disabled = true));
    try {
      const data = await api(`/api/tags/${encodeURIComponent(id)}`, { method: "POST", body: JSON.stringify({ tag_id: Number(b.dataset.tag) }) });
      box.innerHTML = tagButtons(id, data.tags);
      state.tags = null; // 一覧のタグ表示を次回取り直す
    } catch (err) {
      toast(err.message, true);
      box.querySelectorAll("button").forEach((x) => (x.disabled = false));
    }
  });
}
