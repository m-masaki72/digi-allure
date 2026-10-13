import { state, navSeq, tagCounts, loadRanking, loadMonthly, loadTags, publicRanking } from "../state.js";
import { app, esc, cardHTML, monthLabel, lineageHref, lineageGroups } from "../ui.js";

const LEVEL_ORDER = ["成長期", "成熟期", "完全体", "究極体", "超究極体", "アーマー体", "ハイブリッド体"];

// ---------- 図鑑一覧 ----------
function listCardHTML(d) {
  const tags = tagCounts(d.id).slice(0, 2);
  return cardHTML(d, `
      <div class="no">No.${esc(d.no ?? "—")}</div>
      <div class="name">${esc(d.name)}</div>
      <div class="meta">${esc(d.type)}</div>
      ${tags.length ? `<div class="tags">${tags.map((t) => `<span class="mini-tag">${esc(t.label)}</span>`).join("")}</div>` : ""}`);
}

function filtered() {
  const f = state.filters;
  let list = state.list.filter((d) => {
    if (f.levels.size && !f.levels.has(d.level)) return false;
    if (f.lineage && d.lineage !== f.lineage) return false;
    if (f.type && d.type !== f.type) return false;
    if (f.q && !`${d.name} ${d.type} ${d.attribute}`.includes(f.q)) return false;
    if (f.tag && !tagCounts(d.id).some((t) => String(t.tag_id) === f.tag)) return false;
    return true;
  });
  if (f.sort === "popular" && state.ranking) {
    list = [...list].sort((a, b) => (state.ranking.get(a.id)?.rank ?? 1e9) - (state.ranking.get(b.id)?.rank ?? 1e9));
  }
  return list;
}

function renderGrid() {
  const list = filtered();
  document.getElementById("count").textContent = `${list.length} 体`;
  document.getElementById("grid").innerHTML = list.length ? list.map(listCardHTML).join("") : '<p class="empty">該当するデジモンがいません</p>';
}

function renderBanner() {
  const m = state.monthly;
  const top = publicRanking(m)[0];
  document.getElementById("banner").innerHTML = m ? `<a class="banner" href="#/ranking">${esc(monthLabel(m.current))}の人気投票 開催中
    <span>${top ? `現在の1位：<b>${esc(state.byId.get(top.id).name)}</b>` : "まだ投票がありません"} ／ 結果を見る →</span></a>` : "";
}

function renderSortOptions() {
  const f = state.filters;
  document.getElementById("sort").innerHTML = `<option value="no"${f.sort === "no" ? " selected" : ""}>図鑑No.順</option>
    ${state.ranking ? `<option value="popular"${f.sort === "popular" ? " selected" : ""}>人気順</option>` : ""}`;
}

function renderTagChips(settled) {
  const f = state.filters;
  const usedTags = state.tags ? state.tags.tags.filter((t) => state.tags.counts.some((c) => c.tag_id === t.id)) : [];
  if (f.tag && (state.tags || settled) && !usedTags.some((t) => String(t.id) === f.tag)) f.tag = "";
  const row = document.getElementById("tagchips");
  row.hidden = !usedTags.length;
  row.innerHTML = usedTags.length ? `<label>ファンタグ</label>${usedTags.map((t) => `<button class="chip${String(t.id) === f.tag ? " on" : ""}" data-tag="${t.id}">${esc(t.label)}</button>`).join("")}` : "";
}

// 系統の絞り込みは URL（#/list/系統名）だけが持つ。ほかの絞り込みは state.filters に残す
export function viewList(lineage) {
  const seq = navSeq;
  const f = state.filters;
  const lineages = lineageGroups().map(([name]) => name);
  f.lineage = lineages.includes(lineage) ? lineage : "";
  // 公式タイプはどれか1つの系統に属すので、系統と食い違うタイプが残っていると必ず0件になる
  if (f.lineage && f.type && !state.list.some((d) => d.type === f.type && d.lineage === f.lineage)) f.type = "";
  const levels = LEVEL_ORDER.filter((l) => state.list.some((d) => d.level === l));
  const types = [...new Set(state.list.map((d) => d.type))].sort((a, b) => a.localeCompare(b, "ja"));
  app.innerHTML = `
    <h1>お色気デジモン図鑑</h1>
    <p class="lead">管理人が「お色気枠」と認定したデジモンだけを集めた非公式図鑑です。気になる子を見つけたら、詳細ページでタグを付けたり2択投票で推してください。</p>
    <div id="banner"></div>
    <div class="filters">
      <div class="row">
        <input type="search" id="q" placeholder="名前・タイプで検索" value="${esc(f.q)}">
        <select id="type"><option value="">公式タイプ: すべて</option>${types.map((t) => `<option${t === f.type ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>
        <select id="sort"></select>
        <span class="count" id="count" role="status"></span>
      </div>
      <div class="row" id="lineages"><label>系統</label>${lineages.map((l) => `<button class="chip${f.lineage === l ? " on" : ""}" data-lineage="${esc(l)}">${esc(l)}</button>`).join("")}</div>
      <div class="row" id="levels"><label>世代</label>${levels.map((l) => `<button class="chip${f.levels.has(l) ? " on" : ""}" data-level="${esc(l)}">${esc(l)}</button>`).join("")}</div>
      <div class="row" id="tagchips" hidden></div>
    </div>
    <div class="grid" id="grid"></div>`;
  renderBanner();
  renderSortOptions();
  renderTagChips(false);
  renderGrid();
  document.getElementById("q").addEventListener("input", (e) => { f.q = e.target.value.trim(); renderGrid(); });
  document.getElementById("type").addEventListener("change", (e) => { f.type = e.target.value; renderGrid(); });
  document.getElementById("sort").addEventListener("change", (e) => { f.sort = e.target.value; renderGrid(); });
  document.getElementById("lineages").addEventListener("click", (e) => {
    const b = e.target.closest("[data-lineage]");
    if (!b) return;
    f.lineage = f.lineage === b.dataset.lineage ? "" : b.dataset.lineage;
    // 描き直しやスクロールの巻き戻しをさせないよう、hashchange を起こさずに URL だけ合わせる
    history.replaceState(null, "", f.lineage ? lineageHref(f.lineage) : "#/list");
    e.currentTarget.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c.dataset.lineage === f.lineage));
    renderGrid();
  });
  document.getElementById("levels").addEventListener("click", (e) => {
    const b = e.target.closest("[data-level]");
    if (!b) return;
    f.levels.has(b.dataset.level) ? f.levels.delete(b.dataset.level) : f.levels.add(b.dataset.level);
    b.classList.toggle("on");
    renderGrid();
  });
  document.getElementById("tagchips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tag]");
    if (!b) return;
    f.tag = f.tag === b.dataset.tag ? "" : b.dataset.tag;
    e.currentTarget.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c.dataset.tag === f.tag));
    renderGrid();
  });
  const whenCurrent = (fn) => () => { if (seq === navSeq) fn(); };
  loadTags().catch(() => null).then(whenCurrent(() => { renderTagChips(true); renderGrid(); }));
  loadRanking().catch(() => null).then(whenCurrent(() => { renderSortOptions(); if (f.sort === "popular") renderGrid(); }));
  loadMonthly().catch(() => null).then(whenCurrent(renderBanner));
}
