import { state, navSeq, beginNav } from "./state.js";
import { app, esc } from "./ui.js";
import { viewList } from "./views/list.js";
import { viewDetail } from "./views/detail.js";
import { viewVote, stopVoteKeys } from "./views/vote.js";
import { viewRanking } from "./views/ranking.js";
import { viewTypes } from "./views/types.js";
import { viewRequest } from "./views/request.js";

// ---------- ルーティング ----------
async function route() {
  const seq = beginNav();
  stopVoteKeys();
  document.title = "デジアリュール — お色気デジモン図鑑（非公式）";
  const hash = location.hash.replace(/^#/, "") || "/";
  const [, page, arg] = hash.split("/");
  const nav = { "": "list", d: "list", vote: "vote", ranking: "ranking", types: "types", request: "request" }[page ?? ""] ?? "list";
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("on", a.dataset.nav === nav));
  window.scrollTo(0, 0);
  try {
    if (page === "d") await viewDetail(decodeURIComponent(arg ?? ""));
    else if (page === "vote") await viewVote();
    else if (page === "ranking") await viewRanking(arg);
    else if (page === "types") await viewTypes();
    else if (page === "request") await viewRequest();
    else await viewList();
  } catch (e) {
    if (seq === navSeq) app.innerHTML = `<p class="error">${esc(e.message)}</p>`;
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
