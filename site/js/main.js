import { state, navSeq, beginNav } from "./state.js";
import { app, esc } from "./ui.js";
import { api } from "./api.js";
import { viewList } from "./views/list.js";
import { viewDetail } from "./views/detail.js";
import { viewVote, stopVoteKeys } from "./views/vote.js";
import { viewRanking } from "./views/ranking.js";
import { viewTypes } from "./views/types.js";
import { viewRequest } from "./views/request.js";
import { viewHome } from "./views/home.js";
import { viewMy, viewSharedTop } from "./views/my.js";

// ---------- ルーティング ----------
async function route() {
  const seq = beginNav();
  stopVoteKeys();
  document.title = "デジアリュール — 選ばれし魅惑のデジモン図鑑（非公式）";
  const hash = location.hash.replace(/^#/, "") || "/";
  const [, page, arg] = hash.split("/");
  const nav = { list: "list", d: "list", vote: "vote", ranking: "ranking", types: "types", my: "my", top5: "my" }[page ?? ""] ?? "";
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("on", a.dataset.nav === nav));
  window.scrollTo(0, 0);
  try {
    if (page === "d") await viewDetail(decodeURIComponent(arg ?? ""));
    else if (page === "list") await viewList(arg === undefined ? undefined : decodeURIComponent(arg));
    else if (page === "vote") await viewVote();
    else if (page === "ranking") await viewRanking(arg);
    else if (page === "types") await viewTypes();
    else if (page === "request") await viewRequest();
    else if (page === "my") viewMy();
    else if (page === "top5") viewSharedTop(arg);
    else await viewHome();
  } catch (e) {
    if (seq === navSeq) app.innerHTML = `<p class="error">${esc(e.message)}</p>`;
  }
}

async function main() {
  // ヘッダーの検索：ほかの絞り込みを外して図鑑の名前検索に入れ、図鑑を開く（すでに図鑑にいるときは描き直す）
  // データを読み終える前・読めなかったときもフォームの送信（ページの再読み込み）だけは止める
  document.getElementById("site-search").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!state.byId.size) return;
    const input = e.currentTarget.elements.q;
    Object.assign(state.filters, { q: input.value.trim(), lineage: "", type: "", tag: "" });
    state.filters.levels.clear();
    input.blur();
    if (location.hash === "#/list") route();
    else location.hash = "#/list";
  });
  try {
    // /data/* は5分キャッシュされるが、デプロイ直後に新しい JS と古い JSON が混ざらないよう毎回再検証する
    state.list = await api("/data/digimon.json", { cache: "no-cache" });
  } catch {
    app.innerHTML = '<p class="error">図鑑データを読み込めませんでした。</p>'; // 固定文言
    return;
  }
  state.byId = new Map(state.list.map((d) => [d.id, d]));
  window.addEventListener("hashchange", route);
  route();
}
main();
