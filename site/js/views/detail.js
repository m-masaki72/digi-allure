import { api } from "../api.js";
import { state, navSeq, loadRanking } from "../state.js";
import { app, esc, art, toast, detailHref, lineageHref } from "../ui.js";

const OFFICIAL_URL = "https://digimon.net/reference/detail.php?directory_name=";
const SIMILAR_N = 6;
const game8URL = (d) => `https://game8.jp/digimonstory-ts/${encodeURIComponent(d.game8_id)}`;

// 外部サイトへのリンク（内容は転載せず、リンクだけ置く）
function externalLinks(d) {
  const name = encodeURIComponent(d.name);
  return [
    d.official_id && ["公式デジモン図鑑", `${OFFICIAL_URL}${encodeURIComponent(d.official_id)}`],
    d.game8_id && ["入手方法・進化（Game8）", game8URL(d)],
    ["ピクシブ百科事典", `https://dic.pixiv.net/a/${name}`],
    ["pixiv のイラスト", `https://www.pixiv.net/tags/${name}/artworks`],
    ["X で話題を見る", `https://x.com/search?q=${name}`],
  ].filter(Boolean);
}

// ---------- 詳細 ----------
function tagButtons(tags) {
  const cats = [...new Set(tags.map((t) => t.category))];
  return cats.map((cat) => `<div class="tag-group"><div class="cat">${esc(cat)}</div>${tags
    .filter((t) => t.category === cat)
    .map((t) => `<button class="tag-btn${t.mine ? " mine" : ""}" data-tag="${t.id}" aria-pressed="${t.mine}">${esc(t.label)}<span class="n">${t.n}</span></button>`)
    .join("")}</div>`).join("");
}

const rankHTML = (rank) => rank ? `<dt>人気</dt><dd>通算 ${rank.rank}位（${rank.matches}戦 ${rank.wins}勝）</dd>` : "";

export async function viewDetail(id) {
  const seq = navSeq;
  const d = state.byId.get(id);
  if (!d) {
    app.innerHTML = '<p class="empty">このデジモンは見つかりませんでした。<a href="#/list">図鑑へ戻る</a></p>';
    return;
  }
  document.title = `${d.name} — デジアリュール`;
  const similar = state.list.filter((s) => s.lineage === d.lineage && s !== d).slice(0, SIMILAR_N);
  app.innerHTML = `
    <div class="detail">
      <div class="detail-art">
        ${art(d)}
        <div class="actions">
          <a class="btn primary" href="#/vote/${encodeURIComponent(d.id)}">この子で推し診断</a>
          ${d.game8_id ? `<a class="btn" href="${esc(game8URL(d))}" target="_blank" rel="noopener">入手方法（Game8）</a>` : ""}
        </div>
      </div>
      <div>
        <div class="no">タイムストレンジャー図鑑 No.${esc(d.no ?? "—")}</div>
        <h1>${esc(d.name)}</h1>
        <dl class="facts" id="facts">
          <dt>系統</dt><dd><a href="${lineageHref(d.lineage)}">${esc(d.lineage)}</a></dd>
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
        <h2>外部サイトで見る</h2>
        <div class="ext-links">${externalLinks(d).map(([label, url]) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`).join("")}</div>
      </div>
    </div>
    ${similar.length ? `<h2>同じ系統（${esc(d.lineage)}）のデジモン</h2>
    <div class="links">${similar.map((s) => `<a href="${detailHref(s)}">${esc(s.name)}</a>`).join("")}</div>` : ""}`;
  if (!state.ranking) {
    loadRanking().then((r) => {
      if (seq === navSeq) document.getElementById("facts").insertAdjacentHTML("beforeend", rankHTML(r.get(id)));
    }).catch(() => null);
  }
  const box = document.getElementById("tags");
  try {
    const data = await api(`/api/tags/${encodeURIComponent(id)}`);
    if (seq !== navSeq) return;
    box.innerHTML = tagButtons(data.tags);
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
      box.innerHTML = tagButtons(data.tags);
      state.tags = null; // 一覧のタグ表示を次回取り直す
    } catch (err) {
      toast(err.message, true);
      box.querySelectorAll("button").forEach((x) => (x.disabled = false));
    }
  });
}
