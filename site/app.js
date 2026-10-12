const SCOPE = "time-stranger";
const OFFICIAL_URL = "https://digimon.net/reference/detail.php?directory_name=";
const LEVEL_ORDER = ["成長期", "成熟期", "完全体", "究極体", "超究極体", "アーマー体", "ハイブリッド体"];
const IMAGE_CREDIT = { ai_generated: "非公式ファンアート（AI生成）", original_art: "ファンアート" };

const state = {
  list: [],
  byId: new Map(),
  tags: null,      // { tags: [...], counts: [...] } API が使えないときは null
  ranking: null,   // Map(id -> { rank, elo, matches, wins })
  filters: { q: "", levels: new Set(), type: "", tag: "", sort: "no" },
};
const app = document.getElementById("app");

// ---------- ユーティリティ ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function api(path, options) {
  const res = await fetch(path, {
    ...options,
    headers: options?.body ? { "content-type": "application/json" } : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `通信に失敗しました (${res.status})`);
  return data;
}

let toastTimer;
function toast(message, isError = false) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.className = `show${isError ? " err" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = ""), 1800);
}

function art(d) {
  if (d.image_url && d.image_source !== "none") {
    const credit = IMAGE_CREDIT[d.image_source];
    return `<div class="art" data-attr="${esc(d.attribute)}"><img src="${esc(d.image_url)}" alt="${esc(d.name)}" loading="lazy">${credit ? `<span class="credit">${esc(credit)}</span>` : ""}</div>`;
  }
  return `<div class="art" data-attr="${esc(d.attribute)}" aria-hidden="true"><span class="glyph">${esc([...d.name][0])}</span><span class="lv">${esc(d.level)}</span></div>`;
}
const meta = (d) => `${esc(d.level)}・${esc(d.attribute)}・${esc(d.type)}`;

function tagCounts(id) {
  if (!state.tags) return [];
  const label = new Map(state.tags.tags.map((t) => [t.id, t.label]));
  return state.tags.counts
    .filter((c) => c.id === id)
    .sort((a, b) => b.n - a.n)
    .map((c) => ({ ...c, label: label.get(c.tag_id) }));
}

async function loadRanking(force = false) {
  if (state.ranking && !force) return state.ranking;
  const data = await api(`/api/ranking?scope=${SCOPE}`);
  state.ranking = new Map(data.ranking.map((r, i) => [r.id, { ...r, rank: i + 1 }]));
  return state.ranking;
}
async function loadTags(force = false) {
  if (state.tags && !force) return state.tags;
  state.tags = await api("/api/tags");
  return state.tags;
}

// ---------- 図鑑一覧 ----------
function cardHTML(d) {
  const tags = tagCounts(d.id).slice(0, 2);
  return `<a class="card" href="#/d/${encodeURIComponent(d.id)}">
    ${art(d)}
    <div class="body">
      <div class="no">No.${esc(d.no ?? "—")}</div>
      <div class="name">${esc(d.name)}</div>
      <div class="meta">${esc(d.type)}</div>
      ${tags.length ? `<div class="tags">${tags.map((t) => `<span class="mini-tag">${esc(t.label)}</span>`).join("")}</div>` : ""}
    </div>
  </a>`;
}

function filtered() {
  const f = state.filters;
  let list = state.list.filter((d) => {
    if (f.levels.size && !f.levels.has(d.level)) return false;
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
  document.getElementById("grid").innerHTML = list.length ? list.map(cardHTML).join("") : '<p class="empty">該当するデジモンがいません</p>';
}

async function viewList() {
  await Promise.allSettled([loadTags(), loadRanking()]);
  const f = state.filters;
  const levels = LEVEL_ORDER.filter((l) => state.list.some((d) => d.level === l));
  const types = [...new Set(state.list.map((d) => d.type))].sort((a, b) => a.localeCompare(b, "ja"));
  const usedTags = state.tags ? state.tags.tags.filter((t) => state.tags.counts.some((c) => c.tag_id === t.id)) : [];
  app.innerHTML = `
    <h1>お色気デジモン図鑑</h1>
    <p class="lead">管理人が「お色気枠」と認定したデジモンだけを集めた非公式図鑑です。気になる子を見つけたら、詳細ページでタグを付けたり2択投票で推してください。</p>
    <div class="filters">
      <div class="row">
        <input type="search" id="q" placeholder="名前・タイプで検索" value="${esc(f.q)}">
        <select id="type"><option value="">公式タイプ: すべて</option>${types.map((t) => `<option${t === f.type ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>
        <select id="sort">
          <option value="no"${f.sort === "no" ? " selected" : ""}>図鑑No.順</option>
          ${state.ranking ? `<option value="popular"${f.sort === "popular" ? " selected" : ""}>人気順</option>` : ""}
        </select>
        <span class="count" id="count"></span>
      </div>
      <div class="row" id="levels"><label>世代</label>${levels.map((l) => `<button class="chip${f.levels.has(l) ? " on" : ""}" data-level="${esc(l)}">${esc(l)}</button>`).join("")}</div>
      ${usedTags.length ? `<div class="row" id="tagchips"><label>ファンタグ</label>${usedTags.map((t) => `<button class="chip${String(t.id) === f.tag ? " on" : ""}" data-tag="${t.id}">${esc(t.label)}</button>`).join("")}</div>` : ""}
    </div>
    <div class="grid" id="grid"></div>`;
  renderGrid();
  document.getElementById("q").addEventListener("input", (e) => { f.q = e.target.value.trim(); renderGrid(); });
  document.getElementById("type").addEventListener("change", (e) => { f.type = e.target.value; renderGrid(); });
  document.getElementById("sort").addEventListener("change", (e) => { f.sort = e.target.value; renderGrid(); });
  document.getElementById("levels").addEventListener("click", (e) => {
    const b = e.target.closest("[data-level]");
    if (!b) return;
    f.levels.has(b.dataset.level) ? f.levels.delete(b.dataset.level) : f.levels.add(b.dataset.level);
    b.classList.toggle("on");
    renderGrid();
  });
  document.getElementById("tagchips")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tag]");
    if (!b) return;
    f.tag = f.tag === b.dataset.tag ? "" : b.dataset.tag;
    e.currentTarget.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c.dataset.tag === f.tag));
    renderGrid();
  });
}

// ---------- 詳細 ----------
function tagButtons(id, tags) {
  const cats = [...new Set(tags.map((t) => t.category))];
  return cats.map((cat) => `<div class="tag-group"><div class="cat">${esc(cat)}</div>${tags
    .filter((t) => t.category === cat)
    .map((t) => `<button class="tag-btn${t.mine ? " mine" : ""}" data-tag="${t.id}" aria-pressed="${t.mine}">${esc(t.label)}<span class="n">${t.n}</span></button>`)
    .join("")}</div>`).join("");
}

async function viewDetail(id) {
  const d = state.byId.get(id);
  if (!d) {
    app.innerHTML = '<p class="empty">このデジモンは見つかりませんでした。<a href="#/">図鑑へ戻る</a></p>';
    return;
  }
  document.title = `${d.name} — デジアリュール`;
  const rank = await loadRanking().then((r) => r.get(id)).catch(() => null);
  app.innerHTML = `
    <div class="detail">
      <div>${art(d)}</div>
      <div>
        <div class="no">タイムストレンジャー図鑑 No.${esc(d.no ?? "—")}</div>
        <h1>${esc(d.name)}</h1>
        <dl class="facts">
          <dt>世代</dt><dd>${esc(d.level)}</dd>
          <dt>属性</dt><dd>${esc(d.attribute)}</dd>
          <dt>公式タイプ</dt><dd>${esc(d.type)}</dd>
          ${rank ? `<dt>人気</dt><dd>${rank.rank}位（レート ${Math.round(rank.elo)}・${rank.matches}戦）</dd>` : ""}
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
  const box = document.getElementById("tags");
  try {
    const data = await api(`/api/tags/${encodeURIComponent(id)}`);
    box.innerHTML = tagButtons(id, data.tags);
  } catch (e) {
    box.innerHTML = `<p class="error">${esc(e.message)}</p>`;
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

// ---------- 2択投票 ----------
let voteKeyHandler = null;
let votedCount = 0;

async function viewVote() {
  app.innerHTML = `
    <h1>どっちがお好み？</h1>
    <p class="lead">より魅力的だと思う方を選んでください。結果はレーティング（Elo）でランキングに反映されます。キーボードは ← / → で選択、↓ でスキップ。</p>
    <div id="pair"><p class="loading">対戦カードを用意しています…</p></div>
    <div class="vote-foot">
      <button id="skip">どちらとも言えない（スキップ）</button>
      <a href="#/ranking">ランキングを見る</a>
      <div id="voted">${votedCount ? `この訪問で ${votedCount} 票投じました` : ""}</div>
    </div>`;
  let pair = null;
  let busy = false;

  const choiceHTML = (d, side) => `<button class="choice" data-side="${side}">${art(d)}<div class="body"><div class="name">${esc(d.name)}</div><div class="meta">${meta(d)}</div></div></button>`;

  async function next() {
    busy = true;
    try {
      pair = await api(`/api/pair?scope=${SCOPE}`);
      const a = state.byId.get(pair.a), b = state.byId.get(pair.b);
      if (!a || !b) throw new Error("データが古いようです。ページを再読み込みしてください");
      document.getElementById("pair").innerHTML = `<div class="vote">${choiceHTML(a, "a")}<div class="vs">VS</div>${choiceHTML(b, "b")}</div>`;
    } catch (e) {
      document.getElementById("pair").innerHTML = `<p class="error">${esc(e.message)}</p>`;
    } finally {
      busy = false;
    }
  }

  async function choose(side) {
    if (busy || !pair) return;
    busy = true;
    const winner = pair[side];
    const btns = document.querySelectorAll(".choice");
    btns.forEach((b) => { b.disabled = true; b.classList.toggle("win", b.dataset.side === side); });
    try {
      const res = await api("/api/vote", { method: "POST", body: JSON.stringify({ ...pair, winner }) });
      votedCount++;
      document.getElementById("voted").textContent = `この訪問で ${votedCount} 票投じました`;
      toast(`${state.byId.get(winner).name} に投票しました（+${res.delta.toFixed(1)}）`);
      state.ranking = null;
    } catch (e) {
      toast(e.message, true);
    }
    await new Promise((r) => setTimeout(r, 350));
    busy = false;
    next();
  }

  document.getElementById("pair").addEventListener("click", (e) => {
    const b = e.target.closest(".choice");
    if (b) choose(b.dataset.side);
  });
  document.getElementById("skip").addEventListener("click", () => !busy && next());
  voteKeyHandler = (e) => {
    if (e.key === "ArrowLeft") choose("a");
    else if (e.key === "ArrowRight") choose("b");
    else if (e.key === "ArrowDown") { e.preventDefault(); if (!busy) next(); }
  };
  document.addEventListener("keydown", voteKeyHandler);
  next();
}

// ---------- ランキング ----------
async function viewRanking() {
  app.innerHTML = '<h1>人気ランキング</h1><p class="loading">集計中…</p>';
  let ranking;
  try {
    ranking = await loadRanking(true);
  } catch (e) {
    app.innerHTML = `<h1>人気ランキング</h1><p class="error">${esc(e.message)}</p>`;
    return;
  }
  const rows = [...ranking.values()].filter((r) => state.byId.has(r.id));
  const total = rows.reduce((s, r) => s + r.matches, 0) / 2;
  app.innerHTML = `
    <h1>人気ランキング</h1>
    <p class="lead">2択投票の結果をEloレーティングで集計しています（累計 ${Math.round(total)} 票）。対戦数が少ないうちは順位が大きく動きます。</p>
    <table class="rank">
      <thead><tr><th>順位</th><th>デジモン</th><th>世代・タイプ</th><th class="num">レート</th><th class="num">対戦</th><th class="num">勝率</th></tr></thead>
      <tbody>${rows.map((r) => {
        const d = state.byId.get(r.id);
        return `<tr class="${r.rank <= 3 ? "top" : ""}">
          <td>${r.rank}</td>
          <td><a href="#/d/${encodeURIComponent(d.id)}">${esc(d.name)}</a></td>
          <td>${esc(d.level)}・${esc(d.type)}</td>
          <td class="num">${Math.round(r.elo)}</td>
          <td class="num">${r.matches}</td>
          <td class="num">${r.matches ? Math.round((r.wins / r.matches) * 100) + "%" : "—"}</td>
        </tr>`;
      }).join("")}</tbody>
    </table>
    <div class="actions"><a class="btn primary" href="#/vote">投票する</a></div>`;
}

// ---------- タイプから探す ----------
async function viewTypes() {
  await loadTags().catch(() => null);
  const group = (keyOf) => {
    const m = new Map();
    for (const d of state.list) for (const k of [].concat(keyOf(d))) {
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(d);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  };
  const link = (d) => `<a href="#/d/${encodeURIComponent(d.id)}">${esc(d.name)}</a>`;
  const block = ([k, list]) => `<div class="type-group"><h3>${esc(k)}<small>${list.length}体</small></h3><div class="links">${list.map(link).join("")}</div></div>`;

  let tagSection = "";
  if (state.tags?.counts.length) {
    const label = new Map(state.tags.tags.map((t) => [t.id, t.label]));
    const byTag = new Map();
    for (const c of [...state.tags.counts].sort((a, b) => b.n - a.n)) {
      const d = state.byId.get(c.id);
      if (!d) continue;
      if (!byTag.has(c.tag_id)) byTag.set(c.tag_id, []);
      byTag.get(c.tag_id).push(d);
    }
    tagSection = `<h2>ファンタグから探す</h2>${[...byTag.entries()].map(([t, list]) => block([label.get(t), list])).join("")}`;
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

// ---------- ルーティング ----------
async function route() {
  if (voteKeyHandler) {
    document.removeEventListener("keydown", voteKeyHandler);
    voteKeyHandler = null;
  }
  document.title = "デジアリュール — お色気デジモン図鑑（非公式）";
  const hash = location.hash.replace(/^#/, "") || "/";
  const [, page, arg] = hash.split("/");
  const nav = { "": "list", d: "list", vote: "vote", ranking: "ranking", types: "types" }[page ?? ""] ?? "list";
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("on", a.dataset.nav === nav));
  window.scrollTo(0, 0);
  try {
    if (page === "d") await viewDetail(decodeURIComponent(arg ?? ""));
    else if (page === "vote") await viewVote();
    else if (page === "ranking") await viewRanking();
    else if (page === "types") await viewTypes();
    else await viewList();
  } catch (e) {
    app.innerHTML = `<p class="error">${esc(e.message)}</p>`;
  }
}

async function main() {
  try {
    const res = await fetch("/data/digimon.json");
    state.list = await res.json();
  } catch {
    app.innerHTML = '<p class="error">図鑑データを読み込めませんでした。</p>';
    return;
  }
  state.byId = new Map(state.list.map((d) => [d.id, d]));
  window.addEventListener("hashchange", route);
  route();
}
main();
